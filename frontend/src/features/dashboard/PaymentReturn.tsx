"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { post, propertyNaira as naira } from "@/lib/property-api";
import type { Reservation } from "@/lib/reservation-api";
import { useBuyerNotifications } from "@/components/mirai/BuyerNotifications";

export function PaymentReturn() {
  const [record, setRecord] = useState<Reservation | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const { refresh } = useBuyerNotifications();
  const check = useCallback(async () => {
    setBusy(true);
    setError("");
    const query = new URLSearchParams(window.location.search);
    const reference = query.get("reference") || query.get("trxref");
    if (!reference) {
      setError("No payment reference was returned. Open Payments to check your transaction.");
      setBusy(false);
      return;
    }
    try {
      setRecord(await post<Reservation>("/reservations/verify", { reference }));
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm payment.");
    } finally {
      setBusy(false);
    }
  }, [refresh]);
  useEffect(() => {
    void check();
  }, [check]);
  const active = record?.status === "ACTIVE";
  return (
    <section className="mx-auto max-w-2xl py-12">
      <div className="surface p-8 md:p-12">
        <p className="eyebrow">Payment confirmation</p>
        {busy ? (
          <LoaderCircle className="mt-6 size-12 animate-spin text-slate-700" />
        ) : active ? (
          <CheckCircle2 className="mt-6 size-12 text-emerald-700" />
        ) : (
          <Clock3 className="mt-6 size-12 text-amber-700" />
        )}
        <h1 className="mt-6 text-3xl">
          {busy
            ? "Confirming your payment"
            : active
              ? "Your reservation is confirmed"
              : record?.status === "REVIEW_REQUIRED"
                ? "Your payment needs review"
                : "Your reservation is not confirmed yet"}
        </h1>
        <p className="mt-4 leading-7 text-slate-700">
          {busy
            ? "Please wait while MIRAI checks the payment directly with Paystack."
            : active
              ? `${record.plot.title} is now reserved in your name. Your ${naira(record.amount)} payment is recorded in Payments.`
              : record?.reviewReason ||
                "Check your payment status before starting another checkout. Failed or incomplete payments do not reserve the plot."}
        </p>
        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-800">
            {error}
          </p>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={active ? "/dashboard/library" : "/dashboard/payments"}>
              {active ? "Open Land Library" : "Open Payments"}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/payments">View payments</Link>
          </Button>
          {!active && (
            <Button disabled={busy} variant="outline" onClick={() => void check()}>
              Check again
            </Button>
          )}
        </div>
        <p className="mt-7 text-sm text-slate-600">
          A reservation does not transfer land ownership.
        </p>
      </div>
    </section>
  );
}
