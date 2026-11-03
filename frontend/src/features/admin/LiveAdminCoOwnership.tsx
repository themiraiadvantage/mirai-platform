"use client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { authenticatedRequest } from "@/lib/announcement-api";
import { usePropertySearch, propertyNaira as naira } from "@/lib/property-api";
import {
  coStatus,
  paidAmount,
  post,
  usePropertyResource,
  type CoRequest,
  type Match,
  type Page,
  type Policy,
} from "@/lib/property-api";
import { useAdminAccess } from "./admin-auth";
import { PageHead, Panel, Field, Badge, Empty, SearchBox } from "./admin-ui";

export function LiveAdminCoOwnership() {
  const { user } = useAdminAccess();
  const owner = user.staffRole === "SUPER_ADMIN";
  const [q, setQ] = useState("");
  const search = usePropertySearch(q);
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState("");
  const resource = usePropertyResource<Page<CoRequest>>(
    `/admin/co-ownership?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(status ? { status } : {}), ...(cursor ? { cursor } : {}) })}`,
  );
  const policy = usePropertyResource<Policy | null>("/admin/co-ownership/policy");
  const [modal, setModal] = useState<
    "policy" | "propose" | "contribution" | "match" | "cancel" | null
  >(null);
  const [selected, setSelected] = useState<CoRequest | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [termsTitle, setTermsTitle] = useState("");
  const [terms, setTerms] = useState("");
  const [partner, setPartner] = useState("");
  const [agreement, setAgreement] = useState("");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [portions, setPortions] = useState<Record<string, { portion: string; documentId: string }>>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadingMatch, setLoadingMatch] = useState(false);
  function open(type: typeof modal, r?: CoRequest) {
    setSelected(r || null);
    setModal(type);
    setError("");
    setPartner("");
    setCandidateCursor("");
    setAgreement("");
    setNotes("");
    setAmount("");
    setReference("");
    if (type === "policy") {
      setTermsTitle(policy.data?.title || "");
      setTerms(policy.data?.body || "");
    }
  }
  async function inspect(r: CoRequest) {
    if (!r.matchId) return;
    open("match", r);
    setLoadingMatch(true);
    setMatch(null);
    setPortions({});
    try {
      setMatch(await authenticatedRequest<Match>(`/admin/co-ownership/matches/${r.matchId}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load partnership.");
    } finally {
      setLoadingMatch(false);
    }
  }
  async function perform(path: string, body: unknown, message: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await post(path, body);
      toast.success(message);
      setModal(null);
      resource.refresh();
      policy.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save changes.");
    } finally {
      setBusy(false);
    }
  }
  const [candidateCursor, setCandidateCursor] = useState("");
  const candidates = usePropertyResource<{ items: CoRequest[]; nextCursor: string | null }>(
    selected && modal === "propose"
      ? `/admin/co-ownership/requests/${selected.id}/candidates${candidateCursor ? `?cursor=${candidateCursor}` : ""}`
      : "/admin/co-ownership?status=WAITING",
  );
  const waiting = candidates.data?.items || [];
  return (
    <>
      <PageHead
        title="Co-ownership"
        description="Review buyer requests, propose partners and track accepted agreements through allocation."
        action={
          <>
            <Button
              variant="outline"
              onClick={() => {
                resource.refresh();
                policy.refresh();
              }}
            >
              Refresh
            </Button>
            {owner && (
              <Button onClick={() => open("policy")}>
                {policy.data ? "Publish revised terms" : "Set up terms"}
              </Button>
            )}
          </>
        }
      />
      <Panel
        title={
          policy.data ? `Current terms · Version ${policy.data.version}` : "Co-ownership terms"
        }
      >
        <div className="admin-panel-body">
          {policy.error ? (
            <p role="alert">{policy.error}</p>
          ) : policy.loading ? (
            <p>Loading terms…</p>
          ) : policy.data ? (
            <details>
              <summary className="cursor-pointer font-semibold">{policy.data.title}</summary>
              <p className="mt-4 whitespace-pre-wrap leading-7">{policy.data.body}</p>
            </details>
          ) : (
            <p>The Super Admin must publish terms before buyers can request co-ownership.</p>
          )}
          <p className="mt-3 text-sm text-slate-600">
            Each request retains its accepted terms and price. Contributions are entered only after
            both buyers accept a proposed agreement.
          </p>
        </div>
      </Panel>
      <div className="admin-toolbar mt-6">
        <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v);
            setCursor("");
          }}
          placeholder="Search plot code…"
        />
        <select
          aria-label="Request status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setCursor("");
          }}
        >
          <option value="">All requests</option>
          {Object.entries(coStatus).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <span className="text-sm">{resource.data?.total ?? 0} requests</span>
      </div>
      {resource.error && (
        <p role="alert" className="surface p-5">
          {resource.error}
        </p>
      )}
      <Panel>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Buyer</th>
                <th>Plot</th>
                <th>Contribution</th>
                <th>Progress</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {resource.data?.items.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.user.name}</strong>
                    <div className="text-sm">{r.user.email}</div>
                  </td>
                  <td>
                    <strong>{r.plot.code}</strong>
                    <div className="text-sm">
                      {r.plot.location} · Terms v{r.policy.version}
                    </div>
                  </td>
                  <td>
                    {naira(paidAmount(r))} / {naira(r.offer.total)}
                  </td>
                  <td>
                    <Badge>{coStatus[r.status]}</Badge>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {r.status === "WAITING" && (
                        <Button size="sm" variant="outline" onClick={() => open("propose", r)}>
                          Propose partner
                        </Button>
                      )}
                      {r.matchId && r.status !== "CANCELLED" && (
                        <Button size="sm" variant="outline" onClick={() => void inspect(r)}>
                          Review partnership
                        </Button>
                      )}
                      {r.status === "ACTIVE" && (
                        <Button size="sm" variant="outline" onClick={() => open("contribution", r)}>
                          Record contribution
                        </Button>
                      )}
                      {["WAITING", "PROPOSED"].includes(r.status) && (
                        <Button size="sm" variant="ghost" onClick={() => open("cancel", r)}>
                          Cancel request
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {resource.loading && (
          <p className="p-6" role="status">
            Loading buyer requests…
          </p>
        )}
        {!resource.loading && !resource.error && !resource.data?.items.length && (
          <Empty
            title="No buyer requests in this view"
            description="Publish eligible plots and terms. Requests submitted by verified buyers will appear here."
            action={
              <Button variant="outline" asChild>
                <Link href="/admin/plots">Manage plots</Link>
              </Button>
            }
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
      <Dialog
        open={!!modal}
        onOpenChange={(v) => {
          if (!v && !busy) setModal(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {modal === "policy"
                ? "Publish co-ownership terms"
                : modal === "propose"
                  ? "Propose a partner match"
                  : modal === "contribution"
                    ? "Record a confirmed contribution"
                    : modal === "cancel"
                      ? "Cancel this request?"
                      : "Partnership details"}
            </DialogTitle>
            <DialogDescription>
              {selected
                ? `${selected.plot.code} · ${selected.user.name}`
                : "Published versions remain attached to the requests that accepted them."}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
              {error}
            </p>
          )}
          {modal === "policy" && (
            <form
              className="admin-form"
              onSubmit={(e) => {
                e.preventDefault();
                void perform(
                  "/admin/co-ownership/policy",
                  { title: termsTitle, body: terms },
                  "New terms published",
                );
              }}
            >
              <Field label="Title">
                <input
                  required
                  maxLength={160}
                  value={termsTitle}
                  onChange={(e) => setTermsTitle(e.target.value)}
                />
              </Field>
              <Field label="Terms">
                <textarea
                  required
                  minLength={30}
                  maxLength={20000}
                  rows={12}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Set out contributions, payment schedule, allocation, matching, exits, refunds and dispute handling."
                />
              </Field>
              <p className="text-sm text-slate-600">
                Publishing creates a new version. Existing requests retain their accepted version.
              </p>
              <Button disabled={busy}>Publish version {(policy.data?.version || 0) + 1}</Button>
            </form>
          )}
          {modal === "propose" && selected && (
            <form
              className="admin-form"
              onSubmit={(e) => {
                e.preventDefault();
                void perform(
                  "/admin/co-ownership/matches",
                  { firstRequestId: selected.id, secondRequestId: partner, agreement, notes },
                  "Partner match proposed to both buyers",
                );
              }}
            >
              <Field label="Second buyer">
                <select required value={partner} onChange={(e) => setPartner(e.target.value)}>
                  <option value="">Choose a waiting request</option>
                  {waiting
                    .filter((r) => r.id !== selected.id && r.plotId === selected.plotId)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.user.name} · {naira(r.offer.total)} · Terms v{r.policy.version}
                      </option>
                    ))}
                </select>
              </Field>
              <p className="text-sm text-slate-600">
                Choose another waiting buyer for this plot with the same pricing and terms. Only
                requests with matching accepted terms and pricing are listed.
              </p>
              {candidates.error && <p role="alert">{candidates.error}</p>}
              {candidates.loading && <p>Loading eligible partners…</p>}
              {candidates.data?.nextCursor && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCandidateCursor(candidates.data!.nextCursor!);
                    setPartner("");
                  }}
                >
                  More candidates
                </Button>
              )}
              <Field label="Agreement shown to both buyers">
                <textarea
                  required
                  minLength={30}
                  maxLength={20000}
                  rows={7}
                  value={agreement}
                  onChange={(e) => setAgreement(e.target.value)}
                  placeholder="Describe the partners, equal shares, payment dates and agreed allocation arrangements."
                />
              </Field>
              <Field label="Internal notes">
                <textarea
                  maxLength={5000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
              <Button disabled={busy || !partner}>Send proposal for acceptance</Button>
            </form>
          )}
          {modal === "contribution" && selected && (
            <form
              className="admin-form"
              onSubmit={(e) => {
                e.preventDefault();
                void perform(
                  "/admin/co-ownership/contributions",
                  {
                    requestId: selected.id,
                    amount: Number(amount),
                    reference,
                    receivedAt: new Date(`${date}T00:00:00+01:00`).toISOString(),
                  },
                  "Contribution recorded",
                );
              }}
            >
              <p>
                Outstanding: <strong>{naira(selected.offer.total - paidAmount(selected))}</strong>.
                Record funds you have verified as received.
              </p>
              <Field label="Amount received (₦)">
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={selected.offer.total - paidAmount(selected)}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
              <Field label="Unique bank or payment reference">
                <input
                  required
                  minLength={3}
                  maxLength={120}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </Field>
              <Field label="Date received">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Button disabled={busy}>Confirm contribution</Button>
            </form>
          )}
          {modal === "cancel" && selected && (
            <div className="space-y-5">
              <p>
                This cancels {selected.user.name}’s request. A proposed partner returns to matching.
                This action does not process a refund.
              </p>
              <Button
                disabled={busy}
                onClick={() =>
                  void perform(
                    `/admin/co-ownership/requests/${selected.id}/cancel`,
                    {},
                    "Request cancelled",
                  )
                }
              >
                Confirm cancellation
              </Button>
            </div>
          )}
          {modal === "match" && (
            <>
              {loadingMatch && <p role="status">Loading partnership…</p>}
              {match && (
                <div className="admin-form">
                  <Badge>{coStatus[match.status]}</Badge>
                  <div>
                    <h3 className="font-semibold">Agreement</h3>
                    <p className="mt-3 whitespace-pre-wrap leading-7">{match.agreement}</p>
                  </div>
                  {match.notes && (
                    <p className="rounded-xl bg-slate-50 p-4">Internal notes: {match.notes}</p>
                  )}
                  {match.requests.map((r) => (
                    <div key={r.id} className="rounded-xl border p-5">
                      <h3 className="font-semibold">
                        {r.user.name} · {r.acceptedAt ? "Accepted" : "Awaiting acceptance"}
                      </h3>
                      <p className="mt-2">
                        {naira(paidAmount(r))} confirmed of {naira(r.offer.total)}
                      </p>
                      {r.preference && <p className="mt-2">Buyer notes: {r.preference}</p>}
                      {r.contributions.map((c) => (
                        <p className="mt-2 text-sm" key={c.id}>
                          {c.reference} · {naira(Number(c.amount))} ·{" "}
                          {new Date(c.receivedAt).toLocaleDateString("en-NG")}
                        </p>
                      ))}
                    </div>
                  ))}
                  {match.status === "ACTIVE" && (
                    <form
                      className="admin-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void perform(
                          `/admin/co-ownership/matches/${match.id}/allocate`,
                          {
                            portions: match.requests.map((r) => ({
                              userId: r.userId,
                              ...portions[r.userId],
                            })),
                          },
                          "Allocation recorded for both buyers",
                        );
                      }}
                    >
                      <h3 className="text-lg font-semibold">Record final allocation</h3>
                      <p>
                        Both buyers must be fully paid. Upload each buyer’s private PDF in the
                        plot’s Files section, then select it here.
                      </p>
                      {match.requests.map((r) => (
                        <div key={r.id} className="space-y-4 rounded-xl border p-5">
                          <h4 className="font-semibold">{r.user.name}</h4>
                          <Field label="Allocated portion / survey reference">
                            <textarea
                              required
                              minLength={5}
                              value={portions[r.userId]?.portion || ""}
                              onChange={(e) =>
                                setPortions((p) => ({
                                  ...p,
                                  [r.userId]: { ...p[r.userId], portion: e.target.value },
                                }))
                              }
                            />
                          </Field>
                          <Field label="Private allocation PDF">
                            <select
                              required
                              value={portions[r.userId]?.documentId || ""}
                              onChange={(e) =>
                                setPortions((p) => ({
                                  ...p,
                                  [r.userId]: { ...p[r.userId], documentId: e.target.value },
                                }))
                              }
                            >
                              <option value="">Choose document</option>
                              {match.plot.assets
                                .filter(
                                  (a) =>
                                    a.kind === "PRIVATE_DOCUMENT" && a.mime === "application/pdf",
                                )
                                .map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.name}
                                  </option>
                                ))}
                            </select>
                          </Field>
                        </div>
                      ))}
                      <Button
                        disabled={busy || match.requests.some((r) => paidAmount(r) < r.offer.total)}
                      >
                        Confirm both allocations
                      </Button>
                    </form>
                  )}
                  {match.status === "ALLOCATED" &&
                    match.allocations.map((a) => (
                      <p key={a.id} className="rounded-xl bg-emerald-50 p-4">
                        {match.requests.find((r) => r.userId === a.userId)?.user.name}: {a.portion}
                      </p>
                    ))}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
