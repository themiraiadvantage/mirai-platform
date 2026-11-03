"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RESERVATION_FEE, naira, type Plot } from "@/lib/data";
import { useSession } from "@/lib/session";
import { reservePlot, useDemo } from "@/lib/demo-store";

export function ReserveDrawer({
  plot,
  open,
  onOpenChange,
  plan = "Outright",
}: {
  plot: Plot;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plan?: "Outright" | "3mo" | "6mo";
}) {
  const [readAll, setReadAll] = useState(false);
  const [agree, setAgree] = useState(false);
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState<"terms" | "pay" | "processing">("terms");
  const session = useSession();
  const demo = useDemo();
  const [method, setMethod] = useState("Card");
  const router = useRouter();

  const pay = () => {
    if (demo?.owned.some((o) => o.code === plot.code)) {
      toast("This plot is already in your library.");
      router.push(`/dashboard/plots/${plot.code}`);
      return;
    }
    setStep("processing");
    // TODO: initialise Paystack transaction from backend, then verify via callback.
    setTimeout(() => {
      reservePlot(plot.code, plan, method);
      toast.success(`Demo reservation confirmed for ${plot.code}`, {
        description: `${naira(RESERVATION_FEE)} received · receipt in your ledger`,
      });
      onOpenChange(false);
      setStep("terms");
      router.push(`/dashboard/plots/${plot.code}`);
    }, 1800);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        if (step !== "processing") onOpenChange(value);
      }}
    >
      <SheetContent className="w-full overflow-y-auto border-border bg-card sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">Reserve {plot.code}</SheetTitle>
          <SheetDescription>
            Frontend demo · no charge or allocation.
            {plot.location}, {plot.state} · {plot.size} sqm
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          <div className="surface p-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reservation + access fee</span>
              <span className="num font-display text-2xl">{naira(RESERVATION_FEE)}</span>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              <li>· Holds the plot in your name while checks complete</li>
              <li>· 12 months of live location view and document access</li>
              <li>· Renews yearly at the same fee if you haven't started payment</li>
            </ul>
          </div>
          {step === "terms" && (
            <>
              <div>
                <div className="mb-2 text-sm font-medium">Refund & cancellation terms</div>
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Reservation terms, scroll to the end"
                  className="h-40 overflow-y-auto rounded-[10px] border border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground"
                  onScroll={(e) => {
                    const t = e.currentTarget;
                    if (t.scrollTop + t.clientHeight >= t.scrollHeight - 4) setReadAll(true);
                  }}
                >
                  <p>
                    1. The reservation fee is refundable in full within 14 days if any document we
                    listed as "Verified" is later found to be invalid.
                  </p>
                  <br />
                  <p>
                    2. If you cancel for personal reasons within 14 days, we refund 50%. After 14
                    days the fee covers access already used and is not refundable.
                  </p>
                  <br />
                  <p>
                    3. Instalment payments already made are refundable minus documented legal and
                    survey costs, itemised in writing.
                  </p>
                  <br />
                  <p>
                    4. No hidden penalty fees are ever added for late instalments. We will contact
                    you and agree a plan.
                  </p>
                  <br />
                  <p>
                    5. MIRAI is a technology platform, not an estate agency or investment scheme.
                    Land values can go up or down; we make no return guarantees.
                  </p>
                  <br />
                  <p>
                    6. This demo stores sample records in your browser. Do not use real identity or
                    payment information. Production access controls and privacy processes require a
                    backend.
                  </p>
                </div>
                {!readAll && (
                  <p className="mt-1 text-xs text-warning">Scroll to the end to continue.</p>
                )}
              </div>
              <label className="flex gap-3 text-sm">
                <Checkbox
                  disabled={!readAll}
                  checked={agree}
                  onCheckedChange={(v) => setAgree(!!v)}
                />
                I've read and agree to the refund & cancellation terms.
              </label>
              <label className="flex gap-3 text-sm">
                <Checkbox
                  disabled={!readAll}
                  checked={consent}
                  onCheckedChange={(v) => setConsent(!!v)}
                />
                I consent to MIRAI processing my data to manage this reservation.
              </label>
              {session ? (
                <Button
                  size="lg"
                  className="w-full"
                  disabled={!agree || !consent}
                  onClick={() => setStep("pay")}
                >
                  Continue to payment
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="w-full"
                  disabled={!agree || !consent}
                  onClick={() =>
                    router.push(
                      `/sign-in?redirect=${encodeURIComponent(`/dashboard/explore/${plot.code}?plan=${plan}#plans`)}`,
                    )
                  }
                >
                  Sign in to continue
                </Button>
              )}
            </>
          )}
          {step !== "terms" && (
            <div className="space-y-3">
              <div className="text-sm font-medium">Demo payment method</div>
              {["Card", "Bank transfer", "USSD"].map((m, i) => (
                <label
                  key={m}
                  className="surface flex cursor-pointer items-center gap-3 p-3 text-sm"
                >
                  <input
                    type="radio"
                    name="m"
                    checked={method === m}
                    onChange={() => setMethod(m)}
                    className="accent-[var(--primary-bright)]"
                  />
                  {m}
                </label>
              ))}
              <Button size="lg" className="w-full" onClick={pay} disabled={step === "processing"}>
                {step === "processing" ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Processing payment…
                  </>
                ) : (
                  <>Simulate payment · {naira(RESERVATION_FEE)}</>
                )}
              </Button>
              <p className="flex items-center gap-1.5 text-xs text-low">
                <ShieldCheck className="h-3.5 w-3.5" />
                Demo checkout. No real charge is made.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
