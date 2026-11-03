"use client";
import Link from "next/link";
import { useState } from "react";
import { RefreshCw, ArrowUpRight, Pencil, Download, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  post,
  propertyNaira as naira,
  usePropertyResource,
  usePropertySearch,
} from "@/lib/property-api";
import type {
  BuyerContact,
  BuyerPage,
  BuyerDetail,
  BuyerSection,
  BuyerRecordsPage,
} from "@/lib/buyer-api";
import { downloadDocument } from "@/lib/document-api";
import { reservationDate, reservationDateParts } from "@/lib/reservation-api";
import { toast } from "sonner";
import { PageHead, Panel, SearchBox, Modal, Field } from "./admin-ui";

export function LiveAdminBuyers() {
  const [q, setQ] = useState(""),
    search = usePropertySearch(q);
  const [filter, setFilter] = useState("");
  const [cursor, setCursor] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const r = usePropertyResource<BuyerPage>(
    `/admin/buyers?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(filter ? { filter } : {}), ...(cursor ? { cursor } : {}) })}`,
  );
  return (
    <>
      <PageHead
        title="Buyers & ownership"
        description="Customer accounts, reserved plots and ownership records, together in one place."
        action={
          <Button variant="outline" onClick={r.refresh}>
            <RefreshCw size={16} />
            Refresh
          </Button>
        }
      />
      <div className="admin-stat-grid">
        {[
          ["Registered customers", r.data?.stats.registered],
          ["Email verified", r.data?.stats.verified],
          ["With reservations", r.data?.stats.reserved],
          ["Allocated owners", r.data?.stats.allocated],
        ].map(([label, value]) => (
          <div key={label} className="admin-stat">
            <span>{label}</span>
            <strong>{value ?? "…"}</strong>
          </div>
        ))}
      </div>
      <div className="admin-toolbar">
        <SearchBox
          value={q}
          onChange={(value) => {
            setQ(value);
            setCursor("");
          }}
          placeholder="Search name, email or phone…"
        />
        <select
          aria-label="Filter customer accounts"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setCursor("");
          }}
        >
          <option value="">All customers</option>
          <option value="verified">Email verified</option>
          <option value="unverified">Email not verified</option>
          <option value="reserved">With reservations</option>
          <option value="co-ownership">Co-ownership</option>
          <option value="allocated">Allocated owners</option>
        </select>
        <span className="admin-record-count">{r.data?.total ?? 0} customers</span>
      </div>
      {r.error && (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {r.error}
        </p>
      )}
      <Panel>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Reservations</th>
                <th>Co-ownership</th>
                {r.data?.access.payments && <th>Confirmed payments</th>}
                <th>Joined</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {r.data?.items.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="admin-person-cell">
                      <span>
                        {b.name
                          .trim()
                          .split(/\s+/)
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <div>
                        <strong>{b.name}</strong>
                        <small>{b.email}</small>
                        <small className={b.verified ? "text-emerald-700" : "text-amber-700"}>
                          {b.verified ? "Email verified" : "Email not verified"}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong>{b.activeReservations}</strong>
                    <small>Active reservations</small>
                  </td>
                  <td>
                    <strong>{b.partnerships}</strong>
                    <small>
                      {b.allocations ? `${b.allocations} allocated` : "Partnership records"}
                    </small>
                  </td>
                  {r.data?.access.payments && (
                    <td className="admin-money">{naira(b.confirmed || 0)}</td>
                  )}
                  <td>{reservationDateParts(b.joinedAt).date}</td>
                  <td>
                    <Button variant="ghost" size="sm" onClick={() => setSelected(b.id)}>
                      View buyer
                      <ArrowUpRight size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {r.loading && !r.data && (
          <p role="status" className="p-8">
            Loading customer accounts…
          </p>
        )}
        {!r.loading && !r.error && !r.data?.items.length && (
          <div className="p-10 text-center">
            <UserRound size={30} className="mx-auto text-slate-500" />
            <h2 className="mt-4 text-xl">No customers in this view</h2>
            <p className="mt-3 text-sm text-slate-700">
              Customer accounts appear here after signup. Try another search or filter.
            </p>
          </div>
        )}
      </Panel>
      <div className="mt-5 flex gap-3">
        {cursor && (
          <Button variant="outline" onClick={() => setCursor("")}>
            First page
          </Button>
        )}
        {r.data?.nextCursor && (
          <Button variant="outline" onClick={() => setCursor(r.data!.nextCursor!)}>
            More customers
          </Button>
        )}
      </div>
      {selected && (
        <BuyerView
          key={selected}
          id={selected}
          close={() => setSelected(null)}
          changed={r.refresh}
        />
      )}
    </>
  );
}
function BuyerView({ id, close, changed }: { id: string; close: () => void; changed: () => void }) {
  const r = usePropertyResource<BuyerDetail>(`/admin/buyers/${id}`);
  const [tab, setTab] = useState<"overview" | BuyerSection>("overview");
  const [editing, setEditing] = useState(false);
  const b = r.data;
  const tabs: ["overview" | BuyerSection, string][] = [
    ["overview", "Overview"],
    ...(b?.access.reservations ? [["reservations", "Reservations"] as [BuyerSection, string]] : []),
    ...(b?.access.coOwnership ? [["co-ownership", "Co-ownership"] as [BuyerSection, string]] : []),
    ...(b?.access.payments
      ? [
          ["payments", "Reservation fees"] as [BuyerSection, string],
          ["contributions", "Contributions"] as [BuyerSection, string],
        ]
      : []),
    ...(b?.access.documents ? [["documents", "Documents"] as [BuyerSection, string]] : []),
  ];
  return (
    <Modal
      title={b?.name || "Customer account"}
      description={b?.email || "Loading saved account details…"}
      open
      onClose={close}
      wide
    >
      {r.error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          {r.error}
        </p>
      )}
      {r.loading && !b && <p role="status">Loading buyer records…</p>}
      {b &&
        (editing ? (
          <BuyerEditor
            key={b.version}
            buyer={b}
            cancel={() => setEditing(false)}
            saved={() => {
              setEditing(false);
              r.refresh();
              changed();
            }}
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2 border-b pb-4">
              {tabs.map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={tab === key ? "default" : "ghost"}
                  onClick={() => setTab(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
            {tab === "overview" ? (
              <>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${b.verified ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}
                  >
                    {b.verified ? "Email verified" : "Email not verified"}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Pencil size={14} />
                    Edit details
                  </Button>
                </div>
                <dl className="mt-5 grid gap-5 rounded-xl border bg-slate-50 p-5 sm:grid-cols-2">
                  {[
                    ["Phone", b.phone || "Not added"],
                    ["Location", b.location || "Not added"],
                    ["Joined", reservationDate(b.joinedAt)],
                    ["Account", "Registered customer"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-slate-600">{label}</dt>
                      <dd className="mt-2 text-sm font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    ["Active reservations", b.activeReservations],
                    ["Partnerships", b.partnerships],
                    ["Allocated portions", b.allocations],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border p-4">
                      <p className="text-xs text-slate-600">{label}</p>
                      <p className="mt-2 text-xl font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
                {b.access.payments && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Reservation fees paid", b.confirmedFees],
                      ["Co-ownership contributions", b.confirmedContributions],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border p-4">
                        <p className="text-xs text-slate-600">{label}</p>
                        <p className="mt-2 text-xl font-semibold">{naira(Number(value || 0))}</p>
                      </div>
                    ))}
                  </div>
                )}
                <h3 className="mt-6 text-lg font-semibold">Staff notes</h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {b.notes || "No staff notes added."}
                </p>
              </>
            ) : (
              <BuyerRecords key={tab} id={id} section={tab} canOpenPlot={b.access.plots} />
            )}
          </>
        ))}
    </Modal>
  );
}
function BuyerEditor({
  buyer,
  cancel,
  saved,
}: {
  buyer: BuyerContact;
  cancel: () => void;
  saved: () => void;
}) {
  const [form, setForm] = useState({
    name: buyer.name,
    phone: buyer.phone,
    location: buyer.location,
    notes: buyer.notes || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post(`/admin/buyers/${buyer.id}`, { ...form, version: buyer.version });
      toast.success("Buyer details saved");
      saved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save buyer details.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-5">
      <h3 className="text-lg font-semibold">Edit buyer details</h3>
      <Field label="Full name">
        <input
          aria-label="Buyer full name"
          required
          minLength={2}
          maxLength={160}
          value={form.name}
          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
        />
      </Field>
      <Field label="Email">
        <input value={buyer.email} disabled />
        <p className="mt-2 text-xs text-slate-600">
          This email belongs to the customer’s sign-in account.
        </p>
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Phone">
          <input
            aria-label="Buyer phone"
            type="tel"
            maxLength={30}
            value={form.phone}
            onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
          />
        </Field>
        <Field label="Location">
          <input
            aria-label="Buyer location"
            maxLength={160}
            value={form.location}
            onChange={(e) => setForm((s) => ({ ...s, location: e.target.value }))}
          />
        </Field>
      </div>
      <Field label="Staff notes">
        <textarea
          aria-label="Staff notes"
          rows={4}
          maxLength={5000}
          value={form.notes}
          onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
        />
        <p className="mt-2 text-xs text-slate-600">Visible to authorised admins only.</p>
      </Field>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <Button type="button" disabled={busy} variant="outline" onClick={cancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save details"}
        </Button>
      </div>
    </form>
  );
}
function BuyerRecords({
  id,
  section,
  canOpenPlot,
}: {
  id: string;
  section: BuyerSection;
  canOpenPlot: boolean;
}) {
  const [cursor, setCursor] = useState("");
  const r = usePropertyResource<BuyerRecordsPage>(
    `/admin/buyers/${id}/records?${new URLSearchParams({ section, ...(cursor ? { cursor } : {}) })}`,
  );
  const labels: Record<string, string> = {
    PENDING: "Pending",
    SUCCESS: "Confirmed",
    FAILED: "Unsuccessful",
    EXPIRED: "Expired",
    ACTIVE: section === "co-ownership" ? "Contributing" : "Reserved",
    REVIEW_REQUIRED: "Needs attention",
    WAITING: "Waiting for a partner",
    PROPOSED: "Agreement proposed",
    ALLOCATED: "Allocated",
    CANCELLED: "Cancelled",
    AVAILABLE: "Available",
  };
  return (
    <div className="mt-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-600">{r.data?.total ?? 0} records</p>
        <Button variant="ghost" size="sm" onClick={r.refresh}>
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>
      {r.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {r.error}
        </p>
      )}
      {r.loading && !r.data && <p role="status">Loading saved records…</p>}
      <div className="space-y-3">
        {r.data?.items.map((row) => (
          <article key={row.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-amber-800">{row.plot.code}</p>
                <h4 className="mt-2 text-base font-semibold">{row.name || row.plot.title}</h4>
                <p className="mt-2 text-xs text-slate-700">
                  {labels[row.status] || row.status}
                  {row.fileVersion ? ` · v${row.fileVersion}` : ""} · {reservationDate(row.date)}
                </p>
                {row.accessExpiresAt && (
                  <p className="mt-2 text-xs text-slate-700">
                    Access until {reservationDate(row.accessExpiresAt)}
                  </p>
                )}
              </div>
              {row.amount !== null && <p className="font-semibold">{naira(row.amount)}</p>}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {canOpenPlot && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/plots/${row.plot.code}`}>
                    View plot
                    <ArrowUpRight size={14} />
                  </Link>
                </Button>
              )}
              {section === "documents" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void downloadDocument(
                      `/admin/documents/${row.id}/download`,
                      row.name || "Document",
                    ).catch((e) => toast.error(e.message))
                  }
                >
                  <Download size={14} />
                  Download
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!r.loading && !r.error && !r.data?.items.length && (
        <p className="rounded-xl border border-dashed p-7 text-center text-sm text-slate-700">
          No records in this section yet.
        </p>
      )}
      <div className="mt-4 flex gap-3">
        {cursor && (
          <Button variant="outline" size="sm" onClick={() => setCursor("")}>
            First page
          </Button>
        )}
        {r.data?.nextCursor && (
          <Button variant="outline" size="sm" onClick={() => setCursor(r.data!.nextCursor!)}>
            More records
          </Button>
        )}
      </div>
    </div>
  );
}
