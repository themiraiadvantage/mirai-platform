"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Plus,
  ArrowUpRight,
  Download,
  UserRound,
  Wallet,
  CalendarClock,
  FileText,
  Handshake,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { naira, PLOTS, STAGES } from "@/lib/data";
import { downloadText } from "@/lib/demo-store";
import {
  useAdmin,
  uid,
  now,
  dateLabel,
  type Buyer,
  type Reservation,
  type Payment,
} from "./admin-store";
import { PageHead, Panel, Badge, SearchBox, Empty, Modal, Field, FileView } from "./admin-ui";

export function AdminBuyers() {
  const { data, update } = useAdmin();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Buyer | null>(null);
  const [docId, setDocId] = useState("");
  const list = data.buyers.filter((b) =>
    (b.name + b.email + b.id).toLowerCase().includes(q.toLowerCase()),
  );
  const buyer = data.buyers.find((b) => b.id === selected);
  const reservations = data.reservations.filter((r) => r.buyer === selected);
  const payments = data.payments.filter((p) => p.buyer === selected);
  const documents = data.documents.filter(
    (d) => d.visibility === "Buyer only" && d.buyer === selected,
  );
  return (
    <>
      <PageHead
        title="Buyers & ownership"
        description="Understand every buyer’s journey, with their records in one place."
        action={
          <Button
            onClick={() =>
              setEditing({
                id: uid(),
                name: "",
                email: "",
                phone: "",
                location: "",
                joined: now(),
                notes: "",
              })
            }
          >
            <Plus size={16} />
            Add buyer record
          </Button>
        }
      />
      <div className="admin-toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search buyer name or email…" />
        <span className="admin-record-count">{list.length} buyers</span>
      </div>
      <Panel>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Buyer</th>
                <th>Location</th>
                <th>Plot records</th>
                <th>Confirmed payments</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="admin-person-cell">
                      <span>
                        {b.name
                          .split(" ")
                          .map((s) => s[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <div>
                        <strong>{b.name}</strong>
                        <small>{b.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>{b.location || "Not added"}</td>
                  <td>
                    {
                      data.reservations.filter((r) => r.buyer === b.id && r.status !== "Cancelled")
                        .length
                    }
                  </td>
                  <td className="admin-money">
                    {naira(
                      data.payments
                        .filter((p) => p.buyer === b.id && p.status === "Confirmed")
                        .reduce((sum, p) => sum + p.amount, 0),
                    )}
                  </td>
                  <td>{dateLabel(b.joined)}</td>
                  <td>
                    <button className="admin-text-link" onClick={() => setSelected(b.id)}>
                      View buyer <ArrowUpRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.length && <Empty />}
      </Panel>
      <Modal
        title={buyer?.name || "Buyer record"}
        description="A sample buyer profile. Changes here do not create an authentication account."
        open={Boolean(buyer)}
        onClose={() => setSelected(null)}
        wide
      >
        {buyer && (
          <>
            <div className="admin-detail-grid">
              <div>
                <small>Email</small>
                <strong>{buyer.email}</strong>
              </div>
              <div>
                <small>Phone</small>
                <strong>{buyer.phone || "Not added"}</strong>
              </div>
              <div>
                <small>Location</small>
                <strong>{buyer.location || "Not added"}</strong>
              </div>
              <div>
                <small>Joined</small>
                <strong>{dateLabel(buyer.joined)}</strong>
              </div>
            </div>
            <div className="admin-modal-section-head">
              <h3>Plots & ownership</h3>
              <Button variant="outline" size="sm" onClick={() => setEditing(buyer)}>
                Edit buyer details
              </Button>
            </div>
            {reservations.map((r) => (
              <Link key={r.id} href={`/admin/plots/${r.plot}`} className="admin-linked-record">
                <div>
                  <strong>{r.plot}</strong>
                  <small>
                    {r.plan} · {r.stage}
                  </small>
                </div>
                <Badge>{r.status}</Badge>
                <ArrowUpRight size={15} />
              </Link>
            ))}
            {!reservations.length && (
              <p className="text-sm text-muted-foreground">No plot records yet.</p>
            )}
            <h3 className="text-sm font-semibold">Payment history</h3>
            {payments.map((p) => (
              <div className="admin-linked-record" key={p.id}>
                <div>
                  <strong>
                    {naira(p.amount)} · {p.plot}
                  </strong>
                  <small>
                    {p.kind} · {dateLabel(p.date)}
                  </small>
                </div>
                <Badge>{p.status}</Badge>
              </div>
            ))}
            {!payments.length && (
              <p className="text-sm text-muted-foreground">No payments recorded.</p>
            )}
            <h3 className="text-sm font-semibold">Private documents</h3>
            {documents.map((d) => (
              <button
                key={d.id}
                className="admin-linked-record w-full text-left"
                onClick={() => setDocId(d.id)}
              >
                <FileText size={16} />
                <strong>{d.name}</strong>
                <Badge>{d.status}</Badge>
              </button>
            ))}
            {!documents.length && (
              <p className="text-sm text-muted-foreground">No buyer-specific documents attached.</p>
            )}
            <h3 className="text-sm font-semibold">Staff notes</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              {buyer.notes || "No notes added."}
            </p>
          </>
        )}
      </Modal>
      <Modal
        title={
          editing && data.buyers.some((b) => b.id === editing.id)
            ? "Edit buyer record"
            : "Add buyer record"
        }
        description="Preview contact record only. No email is sent and no sign-in account is created."
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form
            className="admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (
                data.buyers.some(
                  (b) =>
                    b.email.toLowerCase() === editing.email.trim().toLowerCase() &&
                    b.id !== editing.id,
                )
              ) {
                toast.error("A buyer with this email already exists.");
                return;
              }
              const value = {
                ...editing,
                name: editing.name.trim(),
                email: editing.email.trim().toLowerCase(),
              };
              if (!value.name) return;
              update("Buyer record saved", value.name, (s) => {
                const index = s.buyers.findIndex((b) => b.id === value.id);
                if (index < 0) s.buyers.unshift(value);
                else s.buyers[index] = value;
              });
              setEditing(null);
              toast.success("Buyer record saved");
            }}
          >
            <Field label="Full name">
              <input
                required
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                required
                type="email"
                value={editing.email}
                onChange={(e) => setEditing({ ...editing, email: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                value={editing.phone}
                onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
              />
            </Field>
            <Field label="Location">
              <input
                value={editing.location}
                onChange={(e) => setEditing({ ...editing, location: e.target.value })}
              />
            </Field>
            <Field label="Internal notes">
              <textarea
                rows={3}
                value={editing.notes}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              />
            </Field>
            <Button>Save buyer record</Button>
          </form>
        )}
      </Modal>
      <FileView
        document={data.documents.find((d) => d.id === docId) || null}
        onClose={() => setDocId("")}
      />
    </>
  );
}

export function AdminReservations() {
  const { data, update } = useAdmin();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Reservation | null>(null);
  const list = data.reservations.filter(
    (r) =>
      (!status || r.status === status) &&
      (r.id + r.plot + data.buyers.find((b) => b.id === r.buyer)?.name)
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const available = data.plots.filter(
    (p) =>
      p.publication === "Published" &&
      p.availability === "Available" &&
      !data.reservations.some((r) => r.plot === p.code && r.status === "Active"),
  );
  const isNew = editing && !data.reservations.some((r) => r.id === editing.id);
  function add() {
    if (!available.length || !data.buyers.length) {
      toast.error("Add a buyer and publish an available plot first.");
      return;
    }
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + available[0].accessMonths);
    setEditing({
      id: uid(),
      buyer: data.buyers[0].id,
      plot: available[0].code,
      date: now().slice(0, 10),
      expires: expiry.toISOString().slice(0, 10),
      plan: available[0].plans[0] || "Outright",
      agreedPrice: available[0].price,
      status: "Active",
      stage: "Reservation",
    });
  }
  return (
    <>
      <PageHead
        title="Reservations"
        description="Keep plot holds, buyer agreements and access periods clearly recorded."
        action={
          <Button onClick={add}>
            <Plus size={16} />
            Add reservation
          </Button>
        }
      />
      <div className="admin-toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search reference, plot or buyer…" />
        <select
          aria-label="Reservation status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option>Active</option>
          <option>Cancelled</option>
          <option>Completed</option>
        </select>
        <span className="admin-record-count">{list.length} reservations</span>
      </div>
      <Panel>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reference / buyer</th>
                <th>Plot / plan</th>
                <th>Reserved</th>
                <th>Access expires</th>
                <th>Stage</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>
                      {r.id.startsWith("RES-") ? r.id : r.id.slice(0, 8).toUpperCase()}
                    </strong>
                    <small>{data.buyers.find((b) => b.id === r.buyer)?.name}</small>
                  </td>
                  <td>
                    <strong>{r.plot}</strong>
                    <small>
                      {r.plan === "Outright" ? "Outright" : r.plan.replace("mo", " months")}
                    </small>
                  </td>
                  <td>{dateLabel(r.date)}</td>
                  <td>{dateLabel(r.expires)}</td>
                  <td>{r.stage}</td>
                  <td>
                    <Badge>{r.status}</Badge>
                  </td>
                  <td>
                    <button className="admin-text-link" onClick={() => setEditing(r)}>
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.length && <Empty />}
      </Panel>
      <Modal
        title={isNew ? "Add reservation" : "Manage reservation"}
        description="Local preview only. This does not allocate real land or move money."
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form
            className="admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              const p = data.plots.find((p) => p.code === editing.plot);
              if (!p || !data.buyers.some((b) => b.id === editing.buyer)) return;
              if (
                editing.status === "Active" &&
                data.reservations.some(
                  (r) => r.id !== editing.id && r.plot === editing.plot && r.status === "Active",
                )
              ) {
                toast.error("This plot already has an active reservation.");
                return;
              }
              if (isNew && !available.some((p) => p.code === editing.plot)) {
                toast.error("Choose an available published plot.");
                return;
              }
              if (new Date(editing.expires) <= new Date(editing.date)) {
                toast.error("Access expiry must be after the reservation date.");
                return;
              }
              update("Reservation saved", editing.plot, (s) => {
                const index = s.reservations.findIndex((r) => r.id === editing.id);
                if (index < 0) s.reservations.unshift({ ...editing, agreedPrice: p.price });
                else s.reservations[index] = editing;
                const plot = s.plots.find((item) => item.code === editing.plot)!;
                plot.availability =
                  editing.status === "Active"
                    ? "Reserved"
                    : editing.status === "Completed"
                      ? "Sold"
                      : "Available";
              });
              setEditing(null);
              toast.success("Reservation updated in preview");
            }}
          >
            <Field label="Buyer">
              <select
                disabled={!isNew}
                value={editing.buyer}
                onChange={(e) => setEditing({ ...editing, buyer: e.target.value })}
              >
                {data.buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Plot">
              <select
                disabled={!isNew}
                value={editing.plot}
                onChange={(e) => {
                  const p = available.find((p) => p.code === e.target.value)!;
                  setEditing({ ...editing, plot: p.code, plan: p.plans[0], agreedPrice: p.price });
                }}
              >
                {(isNew ? available : data.plots.filter((p) => p.code === editing.plot)).map(
                  (p) => (
                    <option key={p.code} value={p.code}>
                      {p.code} · {p.location}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Payment plan">
              <select
                disabled={!isNew}
                value={editing.plan}
                onChange={(e) => setEditing({ ...editing, plan: e.target.value })}
              >
                {(isNew
                  ? data.plots.find((p) => p.code === editing.plot)?.plans || []
                  : [editing.plan]
                ).map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <div className="admin-form-grid">
              <Field label="Reservation date">
                <input
                  type="date"
                  required
                  value={editing.date.slice(0, 10)}
                  onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                />
              </Field>
              <Field label="Access expiry">
                <input
                  type="date"
                  required
                  value={editing.expires.slice(0, 10)}
                  onChange={(e) => setEditing({ ...editing, expires: e.target.value })}
                />
              </Field>
              <Field label="Status">
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({ ...editing, status: e.target.value as Reservation["status"] })
                  }
                >
                  <option>Active</option>
                  <option>Cancelled</option>
                  <option>Completed</option>
                </select>
              </Field>
              <Field label="Recorded workflow stage">
                <select
                  value={editing.stage}
                  onChange={(e) => setEditing({ ...editing, stage: e.target.value })}
                >
                  {STAGES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="admin-callout">
              Agreed land price:{" "}
              {naira(editing.agreedPrice ?? PLOTS.find((p) => p.code === editing.plot)?.price ?? 0)}
              . Updating listing prices does not rewrite this agreement. Completion here is a
              simulation, not legal confirmation.
            </div>
            <Button>Save reservation</Button>
          </form>
        )}
      </Modal>
    </>
  );
}

export function AdminPayments() {
  const { data, update } = useAdmin();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Payment | null>(null);
  const list = data.payments.filter(
    (p) =>
      (!status || p.status === status) &&
      (p.reference + p.plot + data.buyers.find((b) => b.id === p.buyer)?.name)
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const isNew = editing && !data.payments.some((p) => p.id === editing.id);
  function add() {
    if (!data.buyers.length || !data.plots.length) return;
    setEditing({
      id: uid(),
      buyer: data.buyers[0].id,
      plot: data.plots[0].code,
      amount: 0,
      kind: "Instalment",
      method: "Bank transfer",
      date: now().slice(0, 10),
      status: "Pending",
      reference: `PREVIEW-${Date.now()}`,
      note: "",
    });
  }
  function exportCsv() {
    const rows = [
      ["Reference", "Buyer", "Plot", "Amount", "Status", "Date"],
      ...list.map((p) => [
        p.reference,
        data.buyers.find((b) => b.id === p.buyer)?.name || "",
        p.plot,
        p.amount,
        p.status,
        p.date,
      ]),
    ];
    downloadText(
      "mirai-preview-payments.csv",
      rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n"),
      "text/csv",
    );
  }
  return (
    <>
      <PageHead
        title="Payments & reconciliation"
        description="Review transactions, keep a clear ledger and follow up on outstanding payments."
        action={
          <>
            <Button variant="outline" onClick={exportCsv}>
              <Download size={15} />
              Export CSV
            </Button>
            <Button onClick={add}>
              <Plus size={16} />
              Record sample payment
            </Button>
          </>
        }
      />
      <div className="admin-mini-stats">
        {["Confirmed", "Pending", "Failed"].map((s) => (
          <div key={s}>
            <small>{s} transactions</small>
            <strong>
              {naira(
                data.payments.filter((p) => p.status === s).reduce((sum, p) => sum + p.amount, 0),
              )}
            </strong>
          </div>
        ))}
      </div>
      <div className="admin-toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search payment reference or buyer…" />
        <select
          aria-label="Payment status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option>Confirmed</option>
          <option>Pending</option>
          <option>Failed</option>
        </select>
        <span className="admin-record-count">{list.length} transactions</span>
      </div>
      <Panel>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Buyer / plot</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Date</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.reference}</strong>
                    <small>{p.kind}</small>
                  </td>
                  <td>
                    <strong>{data.buyers.find((b) => b.id === p.buyer)?.name}</strong>
                    <small>{p.plot}</small>
                  </td>
                  <td className="admin-money">{naira(p.amount)}</td>
                  <td>{p.method}</td>
                  <td>{dateLabel(p.date)}</td>
                  <td>
                    <Badge>{p.status}</Badge>
                  </td>
                  <td>
                    <button className="admin-text-link" onClick={() => setEditing(p)}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.length && <Empty />}
      </Panel>
      <Modal
        title={isNew ? "Record a sample payment" : "Review transaction"}
        description="Simulation only. Confirming a record here does not confirm a bank or gateway transaction."
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        wide
      >
        {editing && (
          <form
            className="admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (editing.amount <= 0 || !Number.isFinite(editing.amount)) {
                toast.error("Enter an amount greater than zero.");
                return;
              }
              if (
                !editing.reference.trim() ||
                data.payments.some(
                  (p) => p.reference === editing.reference.trim() && p.id !== editing.id,
                )
              ) {
                toast.error("Use a unique payment reference.");
                return;
              }
              if (editing.status === "Confirmed" && !editing.note.trim()) {
                toast.error("Add a reconciliation note before confirming this sample payment.");
                return;
              }
              update(
                "Payment record updated",
                editing.reference,
                (s) => {
                  const index = s.payments.findIndex((p) => p.id === editing.id);
                  if (index < 0) s.payments.unshift(editing);
                  else s.payments[index] = editing;
                },
                `${naira(editing.amount)} · ${editing.status} · ${editing.note}`,
              );
              setEditing(null);
              toast.success("Sample ledger updated. No money moved.");
            }}
          >
            <div className="admin-form-grid">
              <Field label="Buyer">
                <select
                  disabled={!isNew}
                  value={editing.buyer}
                  onChange={(e) => setEditing({ ...editing, buyer: e.target.value })}
                >
                  {data.buyers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Plot">
                <select
                  disabled={!isNew}
                  value={editing.plot}
                  onChange={(e) => setEditing({ ...editing, plot: e.target.value })}
                >
                  {data.plots.map((p) => (
                    <option key={p.code}>{p.code}</option>
                  ))}
                </select>
              </Field>
              <Field label="Amount (₦)">
                <input
                  required
                  disabled={!isNew}
                  type="number"
                  min="1"
                  step="0.01"
                  value={editing.amount || ""}
                  onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })}
                />
              </Field>
              <Field label="Payment type">
                <select
                  disabled={!isNew}
                  value={editing.kind}
                  onChange={(e) => setEditing({ ...editing, kind: e.target.value })}
                >
                  {[
                    "Reservation",
                    "Instalment",
                    "Land payment",
                    "Co-ownership deposit",
                    "Other fee",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="Method">
                <select
                  disabled={!isNew}
                  value={editing.method}
                  onChange={(e) => setEditing({ ...editing, method: e.target.value })}
                >
                  <option>Bank transfer</option>
                  <option>Card</option>
                  <option>USSD</option>
                </select>
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  required
                  disabled={!isNew}
                  value={editing.date}
                  onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                />
              </Field>
              <Field label="Reference">
                <input
                  required
                  disabled={!isNew}
                  value={editing.reference}
                  onChange={(e) => setEditing({ ...editing, reference: e.target.value })}
                />
              </Field>
              <Field label="Reconciliation status">
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({ ...editing, status: e.target.value as Payment["status"] })
                  }
                >
                  <option>Pending</option>
                  <option>Confirmed</option>
                  <option>Failed</option>
                </select>
              </Field>
            </div>
            <Field label="Evidence / reconciliation note">
              <textarea
                required={editing.status === "Confirmed"}
                rows={3}
                value={editing.note}
                onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                placeholder="Record the evidence reviewed and the reason for this decision."
              />
            </Field>
            <div className="admin-callout">
              For the live system, gateway confirmations and bank reconciliation must be verified by
              the backend. This preview only demonstrates the workflow.
            </div>
            <Button>Save sample transaction</Button>
          </form>
        )}
      </Modal>
    </>
  );
}

export function AdminMatches() {
  const { data, update } = useAdmin();
  const [selected, setSelected] = useState<string | null>(null);
  const match = data.matches.find((m) => m.id === selected);
  const [partner, setPartner] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  return (
    <>
      <PageHead
        title="Co-ownership"
        description="Review partner requests, contributions and the proposed allocation workflow."
      />
      <div className="admin-callout mb-6">
        <Handshake size={20} />
        Proposed model. Matching, allocation, contribution and exit terms require confirmation
        before any live launch.
      </div>
      <Panel title="Matching requests">
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Plot</th>
                <th>First buyer</th>
                <th>Proposed partner</th>
                <th>Sample deposit</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.matches.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.plot}</strong>
                  </td>
                  <td>{data.buyers.find((b) => b.id === m.firstBuyer)?.name}</td>
                  <td>{data.buyers.find((b) => b.id === m.secondBuyer)?.name || "Not matched"}</td>
                  <td>{naira(m.deposit)}</td>
                  <td>
                    <Badge>{m.status}</Badge>
                  </td>
                  <td>
                    <button
                      className="admin-text-link"
                      onClick={() => {
                        setSelected(m.id);
                        setPartner(m.secondBuyer);
                        setStatus(m.status);
                        setNotes(m.notes);
                      }}
                    >
                      Review request
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Modal
        title="Review partner matching"
        description="No notification, allocation or financial transaction takes place in this preview."
        open={Boolean(match)}
        onClose={() => setSelected(null)}
      >
        {match && (
          <form
            className="admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (status !== "Looking for partner" && status !== "Cancelled" && !partner) {
                toast.error("Choose a second buyer before moving this request forward.");
                return;
              }
              update("Matching request updated", match.plot, (s) => {
                const m = s.matches.find((m) => m.id === match.id)!;
                m.secondBuyer = partner;
                m.status = status;
                m.notes = notes;
              });
              setSelected(null);
              toast.success("Matching preview updated");
            }}
          >
            <Field label="Proposed partner">
              <select value={partner} onChange={(e) => setPartner(e.target.value)}>
                <option value="">Not matched</option>
                {data.buyers
                  .filter((b) => b.id !== match.firstBuyer)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Workflow status">
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {[
                  "Looking for partner",
                  "Agreement review",
                  "Ready for allocation review",
                  "Cancelled",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Contribution / review notes">
              <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Button>Save matching preview</Button>
          </form>
        )}
      </Modal>
    </>
  );
}
