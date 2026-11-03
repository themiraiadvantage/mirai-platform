"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePropertySearch, propertyNaira as naira } from "@/lib/property-api";
import { authenticatedRequest } from "@/lib/announcement-api";
import {
  assetUrl,
  openPrivateAsset,
  post,
  uploadAsset,
  publicationIssuesFromError,
  type PublicationIssue,
  usePropertyResource,
  type Asset,
  type LivePlot,
  type Page,
} from "@/lib/property-api";
import { PageHead, Panel, Field, Badge, Empty, SearchBox } from "./admin-ui";
import { PlotEvidenceEditor } from "./PlotEvidenceEditor";
import { PropertyImage } from "@/components/mirai/PropertyImage";
import { NIGERIA_STATES, nigeriaStateName } from "@/lib/nigeria-map";

export function LiveAdminPlots({ catalogue = false }: { catalogue?: boolean }) {
  const [q, setQ] = useState("");
  const search = usePropertySearch(q);
  const [status, setStatus] = useState(catalogue ? "Published" : "");
  const [cursor, setCursor] = useState("");
  const resource = usePropertyResource<Page<LivePlot>>(
    `/admin/plots?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(status ? { status } : {}), ...(cursor ? { cursor } : {}) })}`,
  );
  return (
    <>
      <PageHead
        title={catalogue ? "Published catalogue" : "Your plot portfolio"}
        description="Manage listings, documents and co-ownership availability."
        action={
          <Button asChild>
            <Link href="/admin/plots/new">Add plot</Link>
          </Button>
        }
      />
      <div className="admin-toolbar">
        <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v);
            setCursor("");
          }}
          placeholder="Search plots…"
        />
        <select
          aria-label="Publication"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setCursor("");
          }}
        >
          <option value="">All listings</option>
          {["Draft", "Published", "Archived"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <Button variant="outline" onClick={resource.refresh}>
          Refresh
        </Button>
      </div>
      {resource.error && (
        <p role="alert" className="surface p-5">
          {resource.error} <button onClick={resource.refresh}>Try again</button>
        </p>
      )}
      <Panel>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Plot</th>
                <th>Land price</th>
                <th>Availability</th>
                <th>Publication</th>
                <th>Co-ownership</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {resource.data?.items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.title || "Untitled plot"}</strong>
                    <div>
                      {p.code} · {p.location}, {p.state} · {p.size} sqm
                    </div>
                  </td>
                  <td>{naira(Number(p.price))}</td>
                  <td>
                    <Badge>{p.availability}</Badge>
                  </td>
                  <td>
                    <Badge>{p.publication}</Badge>
                  </td>
                  <td>{p.coEnabled ? "Enabled · 50% each" : "Not enabled"}</td>
                  <td>
                    <Link className="admin-text-link" href={`/admin/plots/${p.code}`}>
                      Manage listing →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {resource.loading && (
          <p className="p-6" role="status">
            Loading saved listings…
          </p>
        )}
        {!resource.loading && !resource.error && !resource.data?.items.length && (
          <Empty
            title="No plots yet"
            description="Create a draft, add the listing files, then publish when it is ready."
          />
        )}
        <div className="admin-panel-body flex gap-3">
          {cursor && (
            <Button variant="outline" onClick={() => setCursor("")}>
              First page
            </Button>
          )}
          {resource.data?.nextCursor && (
            <Button variant="outline" onClick={() => setCursor(resource.data!.nextCursor!)}>
              Next page
            </Button>
          )}
        </div>
      </Panel>
    </>
  );
}
function blank(): LivePlot {
  return {
    id: "",
    code: "",
    title: "",
    description: "",
    location: "",
    lga: "",
    state: "",
    size: 0,
    price: 0,
    legalFee: 0,
    surveyFee: 0,
    documentationFee: 0,
    reservationFee: 30000,
    accessMonths: 12,
    publication: "Draft",
    availability: "Available",
    verification: "unchecked",
    coEnabled: false,
    coMonths: 3,
    coDepositPercent: 10,
    version: 1,
    updatedAt: "",
    details: {
      plans: ["Outright"],
      latitude: 6.5,
      longitude: 3.5,
      siteStatus: "Not yet checked",
      docSummary: "",
      notes: "",
    },
    assets: [],
  };
}
export function LivePlotEditor({ code }: { code: string }) {
  const router = useRouter();
  const isNew = code === "new";
  const [plot, setPlot] = useState<LivePlot | null>(null);
  const [error, setError] = useState("");
  const [publicationIssues, setPublicationIssues] = useState<PublicationIssue[]>([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState("Details");
  const [kind, setKind] = useState<Asset["kind"]>("PHOTO");
  const [removeId, setRemoveId] = useState("");
  async function removeFile(id: string) {
    setBusy(true);
    setError("");
    try {
      await post(`/admin/plots/assets/${id}/remove`);
      setPlot((p) => (p ? { ...p, assets: p.assets.filter((a) => a.id !== id) } : p));
      setRemoveId("");
      toast.success("File removed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove file.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    setError("");
    (isNew
      ? authenticatedRequest<{ reservationFee: number; accessMonths: number }>(
          "/admin/auth/settings",
        ).then((s) => ({
          ...blank(),
          reservationFee: s.reservationFee,
          accessMonths: s.accessMonths,
        }))
      : authenticatedRequest<LivePlot>(`/admin/plots/${encodeURIComponent(code)}`)
    )
      .then((p) => {
        if (active) {
          setPlot(p);
          setDirty(false);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [code, isNew, reload]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function change(patch: Partial<LivePlot>) {
    setPlot((p) => (p ? { ...p, ...patch } : p));
    setDirty(true);
  }
  async function save(asDraft = false) {
    if (!plot || busy) return;
    setBusy(true);
    setError("");
    setPublicationIssues([]);
    try {
      const { id } = plot;
      // API records also contain server-owned metadata. Submit only editable fields.
      const values = {
        code: plot.code,
        title: plot.title,
        description: plot.description,
        location: plot.location,
        lga: plot.lga,
        state: plot.state,
        size: plot.size,
        price: Number(plot.price),
        legalFee: Number(plot.legalFee),
        surveyFee: Number(plot.surveyFee),
        documentationFee: Number(plot.documentationFee),
        reservationFee: Number(plot.reservationFee),
        accessMonths: plot.accessMonths,
        publication: asDraft ? "Draft" : plot.publication,
        availability: plot.availability,
        verification: plot.verification,
        coEnabled: plot.coEnabled,
        coMonths: plot.coMonths,
        coDepositPercent: plot.coDepositPercent,
        version: plot.version,
        details: plot.details,
      };
      const saved = await post<LivePlot>(id ? `/admin/plots/${id}` : "/admin/plots", values);
      setPlot(saved);
      setDirty(false);
      toast.success("Listing saved to MIRAI");
      if (isNew) router.replace(`/admin/plots/${saved.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save listing.");
      setPublicationIssues(publicationIssuesFromError(e));
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file || !plot?.id) return;
    setBusy(true);
    setError("");
    try {
      const asset = await uploadAsset(plot.id, file, kind);
      setPlot((p) => (p ? { ...p, assets: [...p.assets, asset] } : p));
      toast.success("File uploaded");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  if (!plot)
    return (
      <Panel>
        <div className="p-8">
          {error ? (
            <>
              <p role="alert">{error}</p>
              <Button onClick={() => setReload((v) => v + 1)}>Try again</Button>
            </>
          ) : (
            <p role="status">Loading listing…</p>
          )}
        </div>
      </Panel>
    );
  const sections = [
    "Details",
    "Pricing",
    "Map & boundaries",
    "Site checks",
    "Files",
    "Co-ownership",
    "Publish",
  ];
  return (
    <>
      <PageHead
        title={isNew ? "Add a plot" : plot.title || plot.code}
        description="Save the draft before uploading files. Published listings appear in the buyer catalogue."
        action={
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        }
      />
      {error && (
        <div role="alert" className="surface mb-5 p-5 text-red-800">
          <p className="font-semibold">{error}</p>
          {!!publicationIssues.length && (
            <ul className="mt-4 space-y-3">
              {publicationIssues.map((issue) => (
                <li
                  key={issue.code}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50/50 p-3"
                >
                  <span className="min-w-0 flex-1 text-sm leading-6">{issue.message}</span>
                  {issue.code === "draft" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void save(true)}
                    >
                      Save as draft
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTab(issue.section);
                        if (issue.code === "photo") setKind("PHOTO");
                        if (issue.code === "document") setKind("LISTING_DOCUMENT");
                      }}
                    >
                      Open {issue.section}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="admin-tabs">
        {sections.map((s) => (
          <button key={s} className={tab === s ? "active" : ""} onClick={() => setTab(s)}>
            {s}
          </button>
        ))}
      </div>
      <Panel title={tab}>
        <div className="admin-panel-body admin-form">
          {tab === "Map & boundaries" && <PlotEvidenceEditor plot={plot} change={change} />}
          {tab === "Site checks" && <PlotEvidenceEditor plot={plot} change={change} site />}
          {tab === "Details" && (
            <>
              <div className="admin-form-grid">
                {(
                  [
                    ["Plot code", "code"],
                    ["Title", "title"],
                    ["Location", "location"],
                    ["LGA", "lga"],
                  ] as const
                ).map(([label, key]) => (
                  <Field key={key} label={label}>
                    <input
                      value={plot[key]}
                      disabled={key === "code" && !!plot.id}
                      onChange={(e) =>
                        change({
                          [key]: key === "code" ? e.target.value.toUpperCase() : e.target.value,
                        })
                      }
                    />
                  </Field>
                ))}
                <Field label="State">
                  <select
                    value={nigeriaStateName(plot.state) || plot.state}
                    onChange={(e) => change({ state: e.target.value })}
                  >
                    <option value="">Choose a state</option>
                    {plot.state && !nigeriaStateName(plot.state) && (
                      <option value={plot.state}>{plot.state}</option>
                    )}
                    {NIGERIA_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state === "FCT" ? "Federal Capital Territory (Abuja)" : state}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Size (sqm)">
                  <input
                    type="number"
                    min="0"
                    value={plot.size}
                    onChange={(e) => change({ size: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <Field label="Description">
                <textarea
                  rows={5}
                  value={plot.description}
                  onChange={(e) => change({ description: e.target.value })}
                />
              </Field>
              <div className="admin-form-grid">
                <Field label="Verification">
                  <select
                    value={plot.verification}
                    onChange={(e) =>
                      change({ verification: e.target.value as LivePlot["verification"] })
                    }
                  >
                    {["unchecked", "pending", "in_progress", "verified"].map((s) => (
                      <option key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Site assessment">
                  <input
                    value={plot.details.siteStatus}
                    onChange={(e) =>
                      change({ details: { ...plot.details, siteStatus: e.target.value } })
                    }
                  />
                </Field>
              </div>
              <Field label="Document summary">
                <input
                  value={plot.details.docSummary}
                  onChange={(e) =>
                    change({ details: { ...plot.details, docSummary: e.target.value } })
                  }
                />
              </Field>
              <Field label="Internal notes">
                <textarea
                  value={plot.details.notes || ""}
                  onChange={(e) => change({ details: { ...plot.details, notes: e.target.value } })}
                />
              </Field>
            </>
          )}
          {tab === "Pricing" && (
            <>
              <div className="admin-form-grid">
                {(
                  [
                    ["Land price (₦)", "price"],
                    ["Legal fee (₦)", "legalFee"],
                    ["Survey fee (₦)", "surveyFee"],
                    ["Documentation fee (₦)", "documentationFee"],
                    ["Reservation fee (₦)", "reservationFee"],
                    ["Access period (months)", "accessMonths"],
                  ] as const
                ).map(([label, key]) => (
                  <Field key={key} label={label}>
                    <input
                      type="number"
                      min="0"
                      value={plot[key]}
                      onChange={(e) => change({ [key]: Number(e.target.value) })}
                    />
                  </Field>
                ))}
              </div>
              <Field label="Payment plans">
                <div className="flex flex-wrap gap-5">
                  {(["Outright", "3mo", "6mo"] as const).map((plan) => (
                    <label key={plan} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={plot.details.plans.includes(plan)}
                        onChange={(e) =>
                          change({
                            details: {
                              ...plot.details,
                              plans: e.target.checked
                                ? [...plot.details.plans, plan]
                                : plot.details.plans.filter((p) => p !== plan),
                            },
                          })
                        }
                      />
                      {plan}
                    </label>
                  ))}
                </div>
              </Field>
            </>
          )}
          {tab === "Files" && (
            <>
              <p>
                Photos and listing documents are visible when the plot is published. Private
                documents are accessible only to staff and the allocated buyer.
              </p>
              {!plot.id ? (
                <p>Save your draft to upload files.</p>
              ) : (
                <>
                  <div className="admin-form-grid">
                    <Field label="File visibility">
                      <select
                        value={kind}
                        onChange={(e) => setKind(e.target.value as Asset["kind"])}
                      >
                        <option value="PHOTO">Listing photo</option>
                        <option value="LISTING_DOCUMENT">Public listing document</option>
                        <option value="PRIVATE_DOCUMENT">Private allocation document</option>
                      </select>
                    </Field>
                    <Field label="Upload file (up to 5 MB)">
                      <input
                        type="file"
                        disabled={busy}
                        accept={
                          kind === "PHOTO"
                            ? "image/png,image/jpeg,image/webp"
                            : "application/pdf,image/png,image/jpeg,image/webp"
                        }
                        onChange={(e) => {
                          void upload(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {plot.assets.map((a) => (
                      <div key={a.id} className="rounded-xl border p-4">
                        {a.kind === "PHOTO" && (
                          <PropertyImage
                            id={a.id}
                            admin
                            alt={a.name}
                            className="mb-3 h-32 w-full rounded-lg object-cover"
                          />
                        )}
                        <strong className="block break-words">{a.name}</strong>
                        <p className="my-2 text-sm">{a.kind.replaceAll("_", " ")}</p>
                        <button
                          className="admin-text-link"
                          onClick={() =>
                            void openPrivateAsset(a.id, true).catch((e) => toast.error(e.message))
                          }
                        >
                          Open file →
                        </button>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {removeId === a.id ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => setRemoveId("")}
                              >
                                Keep file
                              </Button>
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() => void removeFile(a.id)}
                              >
                                Confirm removal
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => setRemoveId(a.id)}
                            >
                              Remove file
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          {tab === "Co-ownership" && (
            <>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={plot.coEnabled}
                  onChange={(e) => change({ coEnabled: e.target.checked })}
                />
                Enable co-ownership for this plot
              </label>
              <p>
                You can enable co-ownership and save its settings at any stage. Buyers can submit
                requests once the plot is published, verified, available and at least 500 sqm, with
                published co-ownership terms.
              </p>
              <div className="admin-form-grid">
                <Field label="Contribution period (months)">
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={plot.coMonths}
                    onChange={(e) => change({ coMonths: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Planned deposit (% of each land share)">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={plot.coDepositPercent}
                    onChange={(e) => change({ coDepositPercent: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <p className="rounded-xl bg-slate-50 p-5">
                Each buyer’s land share: <strong>{naira(Number(plot.price) / 2)}</strong>. Fees are
                divided equally. Submitting a request does not collect money.
              </p>
              <Link className="admin-text-link" href="/admin/co-ownership">
                Manage requests and terms →
              </Link>
            </>
          )}
          {tab === "Publish" && (
            <>
              <div className="admin-form-grid">
                <Field label="Publication">
                  <select
                    value={plot.publication}
                    onChange={(e) =>
                      change({ publication: e.target.value as LivePlot["publication"] })
                    }
                  >
                    {["Draft", "Published", "Archived"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Availability">
                  <select
                    value={plot.availability}
                    onChange={(e) =>
                      change({ availability: e.target.value as LivePlot["availability"] })
                    }
                  >
                    {["Available", "Reserved", "Sold"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <p>
                Publishing requires complete listing details, a photo and a public listing document.
                Existing buyer requests retain their accepted prices and terms.
              </p>
            </>
          )}
        </div>
      </Panel>
      <div className="admin-savebar">
        <span>{dirty ? "You have unsaved changes" : plot.id ? "Saved to MIRAI" : "New draft"}</span>
        <div>
          <Button variant="outline" asChild>
            <Link href="/admin/plots">Back to plots</Link>
          </Button>
          <Button disabled={busy} onClick={() => void save()}>
            Save changes
          </Button>
        </div>
      </div>
    </>
  );
}
