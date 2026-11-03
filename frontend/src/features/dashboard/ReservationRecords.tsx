"use client";
import Link from "next/link";
import { useState } from "react";
import { CreditCard, RefreshCw, Download, ArrowUpRight, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { post, propertyNaira as naira, usePropertyResource } from "@/lib/property-api";
import {
  checkoutUrl,
  reservationDate,
  reservationDateParts,
  type Reservation,
  type ReservationPage,
} from "@/lib/reservation-api";
import { downloadText } from "@/lib/demo-store";
import { useBuyerNotifications } from "@/components/mirai/BuyerNotifications";
import { matchesLibraryFilters, type LibraryFilters } from "@/lib/library-filters";

export function ReservationRecords({
  payments = false,
  compact = false,
  libraryFilters,
}: {
  payments?: boolean;
  compact?: boolean;
  libraryFilters?: LibraryFilters;
}) {
  const [cursor, setCursor] = useState("");
  const records = usePropertyResource<ReservationPage>(
    `/reservations${cursor ? `?cursor=${cursor}` : ""}`,
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const inbox = useBuyerNotifications();
  const visible =
    records.data?.items.filter((row) =>
      matchesLibraryFilters(row.plot, "Reservation", libraryFilters),
    ) || [];
  async function check(row: Reservation) {
    if (!row.payment || busy) return;
    setBusy(row.id);
    setError("");
    try {
      await post<Reservation>("/reservations/verify", { reference: row.payment.reference });
      records.refresh();
      await inbox.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify payment.");
    } finally {
      setBusy("");
    }
  }
  if (compact && !records.data?.items.length && !records.error) return null;
  if (libraryFilters && !records.loading && !records.error && !records.data?.items.length)
    return null;
  return (
    <section className="mt-7" aria-label="Reservation records">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl">{payments ? "Reservation payments" : "Your reservations"}</h2>
          <p className="mt-2 text-sm text-slate-700">
            {payments
              ? "Your reservation fees, payment status and receipts."
              : "Your reserved plots, access periods and next steps."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={records.refresh}>
          <RefreshCw size={15} />
          Refresh
        </Button>
      </div>
      {payments && records.data && (
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <div className="surface p-5">
            <p className="text-sm text-slate-700">Reservation fees paid</p>
            <p className="mt-2 text-2xl font-semibold">{naira(records.data.stats.confirmed)}</p>
          </div>
          <div className="surface p-5">
            <p className="text-sm text-slate-700">Active reservations</p>
            <p className="mt-2 text-2xl font-semibold">{records.data.stats.active}</p>
          </div>
        </div>
      )}
      {(records.error || error) && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {records.error || error}
        </p>
      )}
      {records.loading && !records.data && (
        <div role="status" className="surface animate-pulse p-8">
          Loading your reservations…
        </div>
      )}
      <div className="space-y-4">
        {(compact ? visible.slice(0, 3) : visible).map((row) => (
          <article key={row.id} className="surface overflow-hidden p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-medium tracking-wide text-amber-800">
                  {row.plot.code}
                </p>
                <h3 className="mt-2 text-xl font-semibold">{row.plot.title}</h3>
                <p className="mt-2 text-sm text-slate-700">
                  {row.plot.location}, {row.plot.state} · {row.plot.size} sqm
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${row.status === "ACTIVE" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-800"}`}
              >
                <span
                  className={`size-1.5 rounded-full ${row.status === "ACTIVE" ? "bg-emerald-600" : "bg-slate-500"}`}
                  aria-hidden="true"
                />
                {
                  {
                    ACTIVE: "Reserved",
                    PENDING: "Awaiting payment",
                    FAILED: "Payment unsuccessful",
                    EXPIRED: "Expired",
                    REVIEW_REQUIRED: "Under review",
                  }[row.status]
                }
              </span>
            </div>
            <dl className="mt-6 grid grid-cols-1 gap-5 rounded-xl border border-slate-200 bg-slate-50/70 p-5 min-[400px]:grid-cols-2 xl:grid-cols-4">
              <div>
                <dt className="text-xs font-medium text-slate-600">Reservation fee</dt>
                <dd className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                  {naira(row.amount)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-600">Payment status</dt>
                <dd
                  className={`mt-2 text-sm font-semibold ${row.payment?.status === "SUCCESS" ? "text-emerald-800" : "text-slate-900"}`}
                >
                  {row.payment?.status === "SUCCESS"
                    ? "Confirmed"
                    : row.payment?.status === "FAILED"
                      ? "Unsuccessful"
                      : "Awaiting payment"}
                </dd>
              </div>
              {row.payment?.paidAt && (
                <ReservationDate label="Payment received" value={row.payment.paidAt} />
              )}
              {row.accessExpiresAt && (
                <ReservationDate
                  label={row.status === "EXPIRED" ? "Access ended" : "Access valid until"}
                  value={row.accessExpiresAt}
                />
              )}
            </dl>
            {row.status === "PENDING" && (
              <p className="mt-4 flex items-start gap-2 text-sm text-slate-700">
                <Clock3 size={17} className="shrink-0" />
                Checkout expires {reservationDate(row.checkoutExpiresAt)}. If you already paid,
                check the payment status before paying again.
              </p>
            )}
            {row.reviewReason && (
              <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
                {row.reviewReason}
              </p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button asChild size="sm">
                <Link href={`/dashboard/explore/${row.plot.code}`}>
                  View plot
                  <ArrowUpRight size={14} />
                </Link>
              </Button>
              {row.payment?.status !== "SUCCESS" && row.payment && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!busy}
                  onClick={() => void check(row)}
                >
                  <RefreshCw size={14} className={busy === row.id ? "animate-spin" : ""} />
                  Check payment status
                </Button>
              )}
              {row.status === "PENDING" &&
                row.payment?.status !== "SUCCESS" &&
                row.payment?.authorizationUrl && (
                  <Button asChild size="sm">
                    <a href={checkoutUrl(row.payment.authorizationUrl)}>
                      <CreditCard size={15} />
                      Continue checkout
                    </a>
                  </Button>
                )}
              {row.payment?.status === "SUCCESS" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    downloadText(
                      `${row.payment!.reference}.txt`,
                      [
                        "MIRAI PAYMENT RECEIPT",
                        `Reference: ${row.payment!.reference}`,
                        `Plot: ${row.plot.code} · ${row.plot.title}`,
                        `Reservation / access fee: NGN ${row.amount}`,
                        `Paid: ${row.payment!.paidAt ? reservationDate(row.payment!.paidAt) : "Confirmed"}`,
                        `Reservation status: ${row.status}`,
                        "The fee is separate from the land price. This receipt is not proof of land ownership.",
                      ].join("\n"),
                    )
                  }
                >
                  <Download size={14} />
                  Download receipt
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!records.loading && !records.error && !visible.length && (
        <div className="surface p-8">
          <h3 className="text-xl">
            {records.data?.items.length
              ? "No reservations match these filters."
              : "You haven’t reserved any plots yet."}
          </h3>
          <p className="mt-3 text-sm text-slate-700">
            {records.data?.items.length
              ? "Try another search, state or stage."
              : "Choose a plot and complete its reservation checkout."}
          </p>
          {!records.data?.items.length && (
            <Button className="mt-5" asChild>
              <Link href="/dashboard/explore">Explore plots</Link>
            </Button>
          )}
        </div>
      )}
      <div className="mt-4 flex gap-3">
        {cursor && (
          <Button variant="outline" onClick={() => setCursor("")}>
            First page
          </Button>
        )}
        {records.data?.nextCursor && (
          <Button variant="outline" onClick={() => setCursor(records.data!.nextCursor!)}>
            More records
          </Button>
        )}
        {compact && !!records.data?.total && (
          <Button variant="outline" asChild>
            <Link href="/dashboard/payments">View all payments</Link>
          </Button>
        )}
      </div>
    </section>
  );
}

function ReservationDate({ label, value }: { label: string; value: string }) {
  const parts = reservationDateParts(value);
  return (
    <div>
      <dt className="text-xs font-medium text-slate-600">{label}</dt>
      <dd className="mt-2">
        <time dateTime={value}>
          <span className="block text-sm font-semibold text-slate-900">{parts.date}</span>
          <span className="mt-1 block text-xs text-slate-600">{parts.time} WAT</span>
        </time>
      </dd>
    </div>
  );
}
