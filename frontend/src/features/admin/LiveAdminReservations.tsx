"use client";
import Link from "next/link";
import { useState } from "react";
import { RefreshCw, ArrowUpRight, Eye, Wallet, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  post,
  propertyNaira as naira,
  usePropertyResource,
  usePropertySearch,
} from "@/lib/property-api";
import {
  reservationDate,
  reservationDateParts,
  type Reservation,
  type ReservationPage,
} from "@/lib/reservation-api";
import { PageHead, Panel, SearchBox, Modal } from "./admin-ui";
const reservationLabels: Record<string, string> = {
  PENDING: "Awaiting payment",
  ACTIVE: "Reserved",
  FAILED: "Unsuccessful",
  EXPIRED: "Expired",
  REVIEW_REQUIRED: "Needs attention",
};
function PaymentStatus({ row, payments }: { row: Reservation; payments: boolean }) {
  const label =
    row.status === "REVIEW_REQUIRED"
      ? "Needs attention"
      : payments
        ? row.payment?.status === "SUCCESS"
          ? "Confirmed"
          : row.payment?.status === "FAILED"
            ? "Unsuccessful"
            : "Pending"
        : reservationLabels[row.status];
  const tone =
    row.status === "REVIEW_REQUIRED"
      ? "bg-amber-50 text-amber-800"
      : payments
        ? row.payment?.status === "SUCCESS"
          ? "bg-emerald-50 text-emerald-800"
          : row.payment?.status === "FAILED"
            ? "bg-rose-50 text-rose-800"
            : "bg-amber-50 text-amber-800"
        : row.status === "ACTIVE"
          ? "bg-emerald-50 text-emerald-800"
          : "bg-slate-100 text-slate-700";
  return (
    <span
      className={
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold " + tone
      }
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}
export function LiveAdminReservations({ payments = false }: { payments?: boolean }) {
  const [q, setQ] = useState("");
  const search = usePropertySearch(q);
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState("");
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const resource = usePropertyResource<ReservationPage>(
    `/admin/${payments ? "payments" : "reservations"}?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(status ? { status } : {}), ...(cursor ? { cursor } : {}) })}`,
  );
  async function verify() {
    if (!selected?.payment || busy) return;
    setBusy(true);
    setError("");
    try {
      setSelected(
        await post<Reservation>("/admin/payments/verify", {
          reference: selected.payment.reference,
        }),
      );
      resource.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify payment.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        title={payments ? "Payments" : "Reservations"}
        description={
          payments
            ? "Track collections and view payment details in one place."
            : "Manage reserved plots and buyer access periods."
        }
        action={
          <Button variant="outline" onClick={resource.refresh}>
            <RefreshCw size={16} />
            Refresh
          </Button>
        }
      />
      <div className="mb-7 grid gap-4 sm:grid-cols-2">
        {[
          {
            label: "Total collected",
            value: resource.data ? naira(resource.data.stats.confirmed) : "…",
            note: "Confirmed reservation fees",
            Icon: Wallet,
          },
          {
            label: "Active reservations",
            value: resource.data?.stats.active ?? "…",
            note: "Plots currently reserved",
            Icon: CalendarCheck,
          },
        ].map(({ label, value, note, Icon }) => (
          <div key={label} className="admin-stat">
            <div>
              <span>{label}</span>
              <Icon size={19} />
            </div>
            <strong>{value}</strong>
            <p>{note}</p>
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
          placeholder="Search plot code or buyer email…"
        />
        <select
          aria-label="Reservation status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setCursor("");
          }}
        >
          <option value="">All reservations</option>
          {Object.entries(reservationLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <span className="admin-record-count">{resource.data?.total ?? 0} records</span>
      </div>
      {resource.error && (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
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
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {resource.data?.items.map((row) => {
                const date = reservationDateParts(row.payment?.paidAt || row.createdAt);
                return (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.buyer?.name || "Buyer"}</strong>
                      <small>{row.buyer?.email}</small>
                    </td>
                    <td>
                      <Link href={`/admin/plots/${row.plot.code}`} className="admin-text-link">
                        {row.plot.code}
                        <ArrowUpRight size={13} />
                      </Link>
                      <p
                        className="mt-1 max-w-56 truncate text-xs text-slate-600"
                        title={row.plot.title}
                      >
                        {row.plot.title}
                      </p>
                    </td>
                    <td>
                      <strong>{naira(row.amount)}</strong>
                      <small>Reservation fee</small>
                    </td>
                    <td>
                      <PaymentStatus row={row} payments={payments} />
                    </td>
                    <td>
                      <time dateTime={row.payment?.paidAt || row.createdAt}>
                        <span className="block text-sm font-medium text-slate-800">
                          {date.date}
                        </span>
                        <span className="mt-1 block text-xs text-slate-600">{date.time}</span>
                      </time>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelected(row);
                          setError("");
                        }}
                      >
                        <Eye size={15} />
                        Details
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {resource.loading && !resource.data ? (
          <p role="status" className="p-8">
            Loading records…
          </p>
        ) : !resource.data?.items.length && !resource.error ? (
          <div className="p-10 text-center">
            <h2 className="text-xl">No {payments ? "payments" : "reservations"} in this view</h2>
            <p className="mt-3 text-sm text-slate-700">
              Buyer payments and reservations will appear here.
            </p>
          </div>
        ) : null}
      </Panel>
      <div className="mt-5 flex gap-3">
        {cursor && (
          <Button variant="outline" onClick={() => setCursor("")}>
            First page
          </Button>
        )}
        {resource.data?.nextCursor && (
          <Button variant="outline" onClick={() => setCursor(resource.data!.nextCursor!)}>
            More records
          </Button>
        )}
      </div>
      {selected && (
        <Modal
          title={payments ? "Payment details" : "Reservation details"}
          description={selected.plot.code + " · " + selected.plot.title}
          open
          onClose={() => {
            if (!busy) setSelected(null);
          }}
        >
          <div className="mb-5 flex items-center justify-between rounded-xl border bg-slate-50 p-5">
            <p className="text-2xl font-semibold">{naira(selected.amount)}</p>
            <PaymentStatus row={selected} payments={payments} />
          </div>
          <dl className="divide-y text-sm">
            {[
              ["Buyer", selected.buyer?.name],
              ["Email", selected.buyer?.email],
              ["Reservation", reservationLabels[selected.status]],
              ["Created", reservationDate(selected.createdAt)],
              ...(selected.payment?.paidAt
                ? [["Payment received", reservationDate(selected.payment.paidAt)]]
                : []),
              ...(selected.accessExpiresAt
                ? [["Access until", reservationDate(selected.accessExpiresAt)]]
                : []),
              ...(selected.status === "PENDING"
                ? [["Checkout until", reservationDate(selected.checkoutExpiresAt)]]
                : []),
            ].map(([label, value]) => (
              <div key={label} className="flex flex-wrap justify-between gap-3 py-3">
                <dt className="text-slate-600">{label}</dt>
                <dd className="font-medium text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
          {selected.reviewReason && (
            <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              {selected.reviewReason}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-4 text-sm text-red-800">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button variant="outline" asChild>
              <Link href={`/admin/plots/${selected.plot.code}`}>
                Open plot
                <ArrowUpRight size={14} />
              </Link>
            </Button>
            {payments && selected.payment?.status !== "SUCCESS" && (
              <Button disabled={busy} onClick={() => void verify()}>
                <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
                {busy ? "Checking…" : "Check payment"}
              </Button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
