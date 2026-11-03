"use client";
import { useState } from "react";
import { Upload, FileText, Download, RefreshCw, History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { post, usePropertyResource, usePropertySearch, type Page } from "@/lib/property-api";
import {
  documentFile,
  downloadDocument,
  type LiveDocument,
  type DocumentPage,
} from "@/lib/document-api";
import { reservationDate } from "@/lib/reservation-api";
import { PageHead, Panel, SearchBox, Modal, Field, Badge } from "./admin-ui";

type PlotOption = { id: string; code: string; title: string; publication: string };
type BuyerOption = { id: string; name: string; email: string };
type Form = {
  name: string;
  plotId: string;
  category: string;
  visibility: "Listing" | "Buyer only" | "Staff only";
  buyerId: string;
  notes: string;
};
const visibility = (d: LiveDocument) =>
  d.kind === "LISTING_DOCUMENT" ? "Listing" : d.recipientId ? "Buyer only" : "Staff only";

export function LiveAdminDocuments() {
  const [q, setQ] = useState(""),
    search = usePropertySearch(q);
  const [access, setAccess] = useState("");
  const [cursor, setCursor] = useState("");
  const resource = usePropertyResource<DocumentPage>(
    `/admin/documents?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(access ? { visibility: access } : {}), ...(cursor ? { cursor } : {}) })}`,
  );
  const [editing, setEditing] = useState<LiveDocument | "new" | null>(null);
  const [viewing, setViewing] = useState<LiveDocument | null>(null);
  const [removing, setRemoving] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove(id: string) {
    setBusy(true);
    setError("");
    try {
      await post(`/admin/documents/${id}/remove`);
      setRemoving("");
      resource.refresh();
      toast.success("Document removed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove document.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        title="Documents"
        description="All uploaded documents, organised by plot and buyer, with secure downloads and file history."
        action={
          <Button onClick={() => setEditing("new")}>
            <Upload size={16} />
            Upload document
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
          placeholder="Search document, category or plot code…"
        />
        <select
          aria-label="Filter document visibility"
          value={access}
          onChange={(e) => {
            setAccess(e.target.value);
            setCursor("");
          }}
        >
          <option value="">All visibility</option>
          <option value="Listing">Public listing</option>
          <option>Buyer only</option>
          <option>Staff only</option>
        </select>
        <Button variant="outline" onClick={resource.refresh}>
          <RefreshCw size={15} />
          Refresh
        </Button>
        <span className="admin-record-count">{resource.data?.total ?? 0} documents</span>
      </div>
      {(resource.error || error) && (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {resource.error || error}
        </p>
      )}
      <Panel>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Plot / access</th>
                <th>Uploaded</th>
                <th>Version</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {resource.data?.items.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="admin-file-cell">
                      <span>
                        <FileText size={19} />
                      </span>
                      <div>
                        <strong>{d.name}</strong>
                        <small>{d.category}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong>{d.plot.code}</strong>
                    <small>
                      {visibility(d)}
                      {d.recipient ? ` · ${d.recipient.name}` : ""}
                    </small>
                  </td>
                  <td>
                    <time dateTime={d.createdAt}>{reservationDate(d.createdAt)}</time>
                  </td>
                  <td>
                    v{d.fileVersion}
                    {d._count.allocations > 0 && <small>Allocation record</small>}
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      <button onClick={() => setViewing(d)}>View & history</button>
                      <button disabled={d._count.allocations > 0} onClick={() => setEditing(d)}>
                        Edit
                      </button>
                      <button
                        onClick={() =>
                          void downloadDocument(`/admin/documents/${d.id}/download`, d.name).catch(
                            (e) => toast.error(e.message),
                          )
                        }
                      >
                        Download
                      </button>
                      {removing === d.id ? (
                        <>
                          <button disabled={busy} onClick={() => void remove(d.id)}>
                            Confirm removal
                          </button>
                          <button disabled={busy} onClick={() => setRemoving("")}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          disabled={d._count.allocations > 0}
                          onClick={() => setRemoving(d.id)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {resource.loading && !resource.data && (
          <p className="p-8" role="status">
            Loading documents…
          </p>
        )}
        {!resource.loading && !resource.error && !resource.data?.items.length && (
          <div className="p-10 text-center">
            <FileText className="mx-auto text-slate-500" size={30} />
            <h2 className="mt-4 text-xl">No documents in this view</h2>
            <p className="mt-3 text-sm text-slate-700">
              Upload a document for a saved plot, or adjust your filters.
            </p>
            <Button className="mt-5" variant="outline" onClick={() => setEditing("new")}>
              Upload document
            </Button>
          </div>
        )}
      </Panel>
      <div className="mt-5 flex gap-3">
        {cursor && (
          <Button variant="outline" onClick={() => setCursor("")}>
            First page
          </Button>
        )}
        {resource.data?.nextCursor && (
          <Button variant="outline" onClick={() => setCursor(resource.data!.nextCursor!)}>
            More documents
          </Button>
        )}
      </div>
      {editing && (
        <DocumentEditor
          key={editing === "new" ? "new" : editing.id}
          document={editing === "new" ? null : editing}
          close={() => setEditing(null)}
          saved={() => {
            setEditing(null);
            resource.refresh();
          }}
        />
      )}
      {viewing && <DocumentHistory document={viewing} close={() => setViewing(null)} />}
    </>
  );
}

function DocumentEditor({
  document: d,
  close,
  saved,
}: {
  document: LiveDocument | null;
  close: () => void;
  saved: () => void;
}) {
  const [form, setForm] = useState<Form>({
    name: d?.name || "",
    plotId: d?.plotId || "",
    category: d?.category || "Survey plan",
    visibility: d ? visibility(d) : "Listing",
    buyerId: d?.recipientId || "",
    notes: d?.notes || "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [plotQ, setPlotQ] = useState(""),
    plotSearch = usePropertySearch(plotQ);
  const [plotPage, setPlotPage] = useState({ key: "", cursor: "" });
  const plots = usePropertyResource<Page<PlotOption>>(
    `/admin/documents/plots?${new URLSearchParams({ ...(plotSearch ? { q: plotSearch } : {}), ...(plotPage.key === plotSearch && plotPage.cursor ? { cursor: plotPage.cursor } : {}) })}`,
  );
  const [buyerQ, setBuyerQ] = useState(""),
    buyerSearch = usePropertySearch(buyerQ);
  const [buyerPage, setBuyerPage] = useState({ key: "", cursor: "" });
  const buyerKey = `${form.plotId}:${buyerSearch}`;
  const buyers = usePropertyResource<Page<BuyerOption>>(
    `/admin/documents/plots/${form.plotId}/buyers?${new URLSearchParams({ ...(buyerSearch ? { q: buyerSearch } : {}), ...(buyerPage.key === buyerKey && buyerPage.cursor ? { cursor: buyerPage.cursor } : {}) })}`,
    true,
    !!form.plotId && form.visibility === "Buyer only",
  );
  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((s) => ({ ...s, [key]: value, ...(key === "plotId" ? { buyerId: "" } : {}) }));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post(d ? `/admin/documents/${d.id}` : "/admin/documents", {
        ...form,
        buyerId: form.visibility === "Buyer only" ? form.buyerId : null,
        ...(d ? { version: d.recordVersion } : {}),
        ...(file ? { file: await documentFile(file) } : {}),
      });
      toast.success(d ? "Document updated" : "Document uploaded");
      saved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save document.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={d ? "Manage document" : "Upload document"}
      description="Files are saved to MIRAI. PDF, JPG, PNG and WebP files up to 5 MB."
      open
      onClose={() => {
        if (!busy) close();
      }}
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-5">
        {!d && (
          <Field label="Find a plot">
            <input
              aria-label="Find a plot"
              placeholder="Search plot code or title…"
              value={plotQ}
              onChange={(e) => setPlotQ(e.target.value)}
            />
          </Field>
        )}
        <Field label="Plot">
          <select
            aria-label="Document plot"
            required
            disabled={!!d || busy}
            value={form.plotId}
            onChange={(e) => update("plotId", e.target.value)}
          >
            <option value="">Choose a plot</option>
            {d && (
              <option value={d.plotId}>
                {d.plot.code} · {d.plot.title}
              </option>
            )}
            {plots.data?.items
              .filter((p) => p.id !== d?.plotId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.title || "Untitled plot"}
                </option>
              ))}
          </select>
          {plots.error && (
            <p role="alert" className="text-sm text-red-700">
              {plots.error}
            </p>
          )}
          {!d && (
            <div className="mt-2 flex gap-3">
              {plotPage.cursor && (
                <button
                  type="button"
                  className="text-sm underline"
                  onClick={() => setPlotPage({ key: plotSearch, cursor: "" })}
                >
                  First plots
                </button>
              )}
              {plots.data?.nextCursor && (
                <button
                  type="button"
                  className="text-sm underline"
                  onClick={() => setPlotPage({ key: plotSearch, cursor: plots.data!.nextCursor! })}
                >
                  More plots
                </button>
              )}
            </div>
          )}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Document name">
            <input
              aria-label="Document name"
              required
              maxLength={160}
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </Field>
          <Field label="Category">
            <input
              aria-label="Document category"
              required
              maxLength={80}
              list="document-categories"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
            />
            <datalist id="document-categories">
              {[
                "Survey plan",
                "Title document",
                "Deed of assignment",
                "Allocation letter",
                "Site report",
                "Agreement",
                "General",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </datalist>
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Visibility">
            <select
              aria-label="Document visibility"
              value={form.visibility}
              onChange={(e) => update("visibility", e.target.value as Form["visibility"])}
            >
              <option>Listing</option>
              <option>Buyer only</option>
              <option>Staff only</option>
            </select>
          </Field>
        </div>
        <p className="rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          Listing documents are public when the plot is published. Buyer-only documents appear in
          the selected buyer’s vault immediately. Staff-only files stay within admin.
        </p>
        {form.visibility === "Buyer only" && (
          <Field label="Buyer">
            <input
              aria-label="Find buyer"
              placeholder="Search buyer name or email…"
              value={buyerQ}
              onChange={(e) => setBuyerQ(e.target.value)}
            />
            <select
              aria-label="Document buyer"
              required
              value={form.buyerId}
              onChange={(e) => update("buyerId", e.target.value)}
              disabled={!form.plotId}
            >
              <option value="">Choose an eligible buyer</option>
              {d?.recipient && (
                <option value={d.recipient.id}>
                  {d.recipient.name} · {d.recipient.email}
                </option>
              )}
              {buyers.data?.items
                .filter((b) => b.id !== d?.recipientId)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} · {b.email}
                  </option>
                ))}
            </select>
            <p className="mt-2 text-xs text-slate-700">
              Only buyers with an active reservation or co-ownership record for this plot are
              eligible.
            </p>
            {buyers.error && (
              <p role="alert" className="text-sm text-red-700">
                {buyers.error}
              </p>
            )}
            {buyers.data?.nextCursor && (
              <button
                type="button"
                className="mt-2 text-sm underline"
                onClick={() => setBuyerPage({ key: buyerKey, cursor: buyers.data!.nextCursor! })}
              >
                More buyers
              </button>
            )}
            {buyerPage.cursor && (
              <button
                type="button"
                className="ml-3 text-sm underline"
                onClick={() => setBuyerPage({ key: buyerKey, cursor: "" })}
              >
                First buyers
              </button>
            )}
          </Field>
        )}
        <Field label={d ? "Replacement file (optional)" : "Upload file"}>
          <input
            aria-label="Document file"
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            required={!d}
            disabled={busy}
            onChange={(e) => {
              const next = e.target.files?.[0] || null;
              setFile(next);
              if (next) setForm((s) => ({ ...s, name: s.name || next.name }));
            }}
          />
          <p className="mt-2 text-xs text-slate-700">
            {d
              ? "Uploading a replacement adds a new version. Previous files remain in history."
              : "A real file is required to create a document."}
          </p>
        </Field>
        <Field label="Internal notes">
          <textarea
            aria-label="Internal notes"
            rows={3}
            maxLength={5000}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
        </Field>
        <p className="text-xs text-slate-700">Internal notes are visible to admins only.</p>
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : d ? "Save changes" : "Upload document"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function DocumentHistory({ document: d, close }: { document: LiveDocument; close: () => void }) {
  const r = usePropertyResource<LiveDocument>(`/admin/documents/${d.id}`);
  return (
    <Modal title={d.name} description={`${d.plot.code} · ${d.category}`} open onClose={close}>
      {r.loading && <p role="status">Loading document history…</p>}
      {r.error && <p role="alert">{r.error}</p>}
      {r.data && (
        <>
          <div className="rounded-xl border bg-slate-50 p-4 text-sm leading-6">
            <p>
              <strong>Access:</strong> {visibility(r.data)}
              {r.data.recipient ? ` · ${r.data.recipient.name}` : ""}
            </p>
            <p>
              <strong>Uploaded:</strong> {reservationDate(r.data.createdAt)}
            </p>
            <p>
              <strong>Last updated:</strong> {reservationDate(r.data.updatedAt)}
            </p>
            {r.data.notes && (
              <p className="mt-3 whitespace-pre-wrap">
                <strong>Internal notes:</strong> {r.data.notes}
              </p>
            )}
          </div>
          <h3 className="mt-6 flex items-center gap-2 text-lg font-semibold">
            <History size={18} />
            Version history
          </h3>
          <div className="mt-4 space-y-3">
            {r.data.versions?.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
              >
                <div>
                  <p className="font-semibold">
                    v{v.number} · {v.name}
                  </p>
                  <p className="mt-2 text-xs text-slate-700">
                    {reservationDate(v.createdAt)} · {Math.ceil(v.size / 1024)} KB · {v.uploadedBy}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void downloadDocument(
                      `/admin/documents/${d.id}/versions/${v.number}/download`,
                      v.name,
                    ).catch((e) => toast.error(e.message))
                  }
                >
                  <Download size={15} />
                  Download
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
