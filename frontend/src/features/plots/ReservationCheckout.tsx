"use client";
import Link from "next/link";
import { useState } from "react";
import { ShieldCheck, CreditCard, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { post, propertyNaira as naira, type LivePlot } from "@/lib/property-api";
import { useSession } from "@/lib/session";
import { authHref } from "@/lib/navigation";
import { checkoutUrl, reservationTermsVersion, type Reservation } from "@/lib/reservation-api";

export function ReservationCheckout({ plot }: { plot: LivePlot }) {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const destination = `/dashboard/explore/${encodeURIComponent(plot.code)}`;
  if (session?.staffRole)
    return <p className="mt-5 text-sm text-slate-700">Use a customer account to reserve a plot.</p>;
  if (plot.availability !== "Available")
    return (
      <Button variant="outline" className="mt-5 w-full" asChild>
        <Link href="/dashboard/library">View your Land Library</Link>
      </Button>
    );
  async function pay() {
    if (busy || !accepted) return;
    setBusy(true);
    setError("");
    try {
      const result = await post<Reservation & { authorizationUrl: string | null }>(
        "/reservations/checkout",
        {
          plotId: plot.id,
          version: plot.version,
          termsVersion: reservationTermsVersion,
          accepted: true,
        },
      );
      if (
        result.authorizationUrl &&
        (result.amount !== Number(plot.reservationFee) || result.accessMonths !== plot.accessMonths)
      )
        throw new Error(
          "You already have an earlier checkout with different fees or access terms. Review that checkout in Payments before continuing.",
        );
      window.location.assign(
        result.authorizationUrl ? checkoutUrl(result.authorizationUrl) : "/dashboard/library",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
      setBusy(false);
    }
  }
  return (
    <>
      <div className="mt-6 border-t pt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-amber-800">
          Reserve your plot
        </p>
        {session ? (
          <Button
            className="w-full"
            disabled={Number(plot.reservationFee) <= 0}
            onClick={() => {
              setOpen(true);
              setError("");
              setAccepted(false);
            }}
          >
            <CreditCard size={17} />
            Reserve this plot · {naira(Number(plot.reservationFee))}
          </Button>
        ) : (
          <Button className="w-full" asChild>
            <Link href={authHref("/sign-in", destination)}>
              Sign in to reserve · {naira(Number(plot.reservationFee))}
            </Link>
          </Button>
        )}
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Continue to Paystack to complete your reservation.
        </p>
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Reserve your plot</DialogTitle>
            <DialogDescription>
              Review your reservation before continuing to Paystack checkout.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-slate-50 p-5">
            <p className="font-mono text-sm text-amber-800">{plot.code}</p>
            <h2 className="mt-2 text-xl font-semibold">{plot.title}</h2>
            <p className="mt-2 text-sm text-slate-700">
              {plot.location}, {plot.state} · {plot.size} sqm
            </p>
          </div>
          <dl className="divide-y text-sm">
            {[
              ["Reservation / access fee", naira(Number(plot.reservationFee))],
              ["Access period after confirmation", `${plot.accessMonths} months`],
              ["Land price (separate)", naira(Number(plot.price))],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-3">
                <dt>{label}</dt>
                <dd className="text-right font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-slate-800">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldCheck size={18} />
              Reservation terms
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Your checkout window lasts 20 minutes. The reservation starts only after the server
                confirms payment.
              </li>
              <li>
                The reservation holds this plot in your name for the stated access period. It does
                not transfer ownership.
              </li>
              <li>
                This fee is separate from the land price, ownership fees and any co-ownership
                deposit. It is not deducted from the land price.
              </li>
              <li>Your reservation does not renew automatically.</li>
            </ul>
          </div>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              className="mt-1 size-4 shrink-0 accent-slate-900"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              disabled={busy}
            />
            I understand and accept these reservation terms.
          </label>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {error}{" "}
              <Link className="underline" href="/dashboard/payments">
                View Payments
              </Link>
            </p>
          )}
          <Button className="w-full" disabled={!accepted || busy} onClick={() => void pay()}>
            {busy ? <LoaderCircle size={17} className="animate-spin" /> : <CreditCard size={17} />}
            {busy
              ? "Preparing secure checkout…"
              : `Continue to Paystack · ${naira(Number(plot.reservationFee))}`}
          </Button>
          <p className="text-center text-xs text-slate-600">
            Checkout is securely handled by Paystack.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
