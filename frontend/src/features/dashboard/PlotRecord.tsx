"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, FileText, History, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getPlot, naira, STAGES, DOC_HISTORY, ALERTS, planSchedule } from "@/lib/data";
import { useDemo, recordPayment, downloadReceipt, downloadText } from "@/lib/demo-store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { BeaconMap, SiteChecks } from "@/components/mirai/SiteChecks";
import { EmptyState, StatusChip } from "@/components/mirai/primitives";
import { OwnershipSummary } from "./OwnershipSummary";

export default function PlotRecord({ code }: { code: string }) {
  const demo = useDemo(),
    plot = getPlot(code),
    owned = demo?.owned.find((o) => o.code === code),
    [pay, setPay] = useState<number | null>(null),
    [method, setMethod] = useState("Card"),
    [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("summary");
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    setTab(
      requested && ["summary", "ledger", "documents", "map", "site", "activity"].includes(requested)
        ? requested
        : "summary",
    );
  }, [code]);
  if (!demo) return <div className="h-96 animate-pulse rounded-xl bg-card" />;
  if (!plot || !owned)
    return (
      <EmptyState
        title="This plot is not in your library."
        cta={
          <Button asChild>
            <Link href="/dashboard/library">Back to library</Link>
          </Button>
        }
      />
    );
  const total = planSchedule(plot.price, owned.plan).total,
    receipts = demo.receipts.filter((r) => r.code === code);
  const pending = owned.instalments.filter((i) => i.status !== "Paid"),
    next = pending[0];
  async function confirm() {
    if (pay === null || busy) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 850));
    const i = owned!.instalments[pay];
    if (!i) {
      setBusy(false);
      return;
    }
    recordPayment(code, i.amount, method, "Instalment", pay);
    setPay(null);
    setBusy(false);
    toast.success("Demo payment recorded", {
      description: "Your ledger and receipt have been updated. No real charge was made.",
    });
  }
  return (
    <>
      <Link
        href="/dashboard/library"
        className="inline-flex items-center gap-2 text-xs text-muted-foreground"
      >
        <ArrowLeft size={14} />
        Land Library
      </Link>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your ownership record · {plot.code}</p>
          <h1 className="page-title">
            {plot.location}, {plot.state}
          </h1>
          <p className="page-subtitle">
            {plot.size} sqm ·{" "}
            {owned.plan === "Outright"
              ? "Outright purchase"
              : owned.plan.replace("mo", " month plan")}
          </p>
        </div>
        <StatusChip status={plot.status} />
      </div>
      <div className="surface my-8 grid grid-cols-5 gap-2 p-5 md:p-7">
        {STAGES.map((s, i) => (
          <div key={s}>
            <div
              className={`mb-3 h-1 rounded-full ${i <= STAGES.indexOf(owned.stage) ? "bg-gold" : "bg-border"}`}
            />
            <span
              className={`text-xs sm:text-xs ${i <= STAGES.indexOf(owned.stage) ? "text-gold" : "text-low"}`}
            >
              {s}
            </span>
          </div>
        ))}
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full justify-start overflow-x-auto border border-border bg-card p-1">
          {[
            ["summary", "Ownership overview"],
            ["ledger", "Payments & receipts"],
            ["documents", "Document vault"],
            ["map", "GPS & beacons"],
            ["site", "Site assessment"],
            ["activity", "Activity"],
          ].map(([v, l]) => (
            <TabsTrigger key={v} value={v} className="px-4 py-3">
              {l}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="summary" className="mt-6">
          <OwnershipSummary plot={plot} owned={owned} />
        </TabsContent>
        <TabsContent value="ledger" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Plan land total", naira(total)],
              ["Amount paid", naira(owned.paid)],
              ["Remaining land balance", naira(Math.max(0, total - owned.paid))],
            ].map(([l, v]) => (
              <div key={l} className="surface p-6">
                <p className="text-xs text-muted-foreground">{l}</p>
                <p className="mt-3 num text-3xl">{v}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-low">
            Reservation/access fees are separate from the land price. Legal, documentation and
            survey costs are listed on the{" "}
            <Link href={`/dashboard/explore/${code}`} className="underline">
              plot details
            </Link>
            .
          </p>
          {owned.instalments.some((i) => i.status === "Overdue") && (
            <div className="mt-5 rounded-xl border border-warning/30 bg-warning/5 p-5 text-sm">
              <p className="text-warning">An instalment is overdue.</p>
              <p className="mt-2 text-muted-foreground">
                No hidden penalty fees have been added. Review the amount below or email
                hello@mirai.ng to discuss a revised payment date.
              </p>
            </div>
          )}
          <div className="surface mt-6 overflow-x-auto">
            <div className="border-b border-border p-5">
              <h2 className="text-xl">Instalment schedule</h2>
              <p className="mt-1 text-xs text-low">Every due date and payment, in one ledger.</p>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Instalment</th>
                  <th>Due date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {owned.instalments.map((i, n) => (
                  <tr key={n}>
                    <td>{String(n + 1).padStart(2, "0")}</td>
                    <td>{i.due}</td>
                    <td className="num">{naira(i.amount)}</td>
                    <td>
                      <span
                        className={`status-dot ${i.status === "Paid" ? "text-success bg-success/10" : i.status === "Overdue" ? "text-warning bg-warning/10" : "text-info bg-info/10"}`}
                      >
                        {i.status}
                      </span>
                    </td>
                    <td>
                      {i.status !== "Paid" ? (
                        <Button size="sm" variant="outline" onClick={() => setPay(n)}>
                          Make payment
                        </Button>
                      ) : (
                        <span className="text-xs text-low">Recorded</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!owned.instalments.length && (
              <p className="p-6 text-sm text-muted-foreground">
                Reservation recorded. A payment schedule will be agreed before instalments begin.
              </p>
            )}
          </div>
          <h2 className="mb-4 mt-8 text-2xl">Receipts</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {receipts.map((r) => (
              <div key={r.id} className="surface flex items-center gap-3 p-4">
                <FileText size={20} className="text-gold" />
                <div className="flex-1">
                  <p className="num text-sm">
                    {naira(r.amount)} · {r.kind}
                  </p>
                  <p className="mt-1 text-xs text-low">
                    {new Date(r.date).toLocaleDateString("en-NG")} · {r.id}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Download demo receipt"
                  onClick={() => downloadReceipt(r)}
                >
                  <Download size={16} />
                </Button>
              </div>
            ))}
            {!receipts.length && (
              <p className="text-sm text-muted-foreground">
                Receipts for payments simulated in this browser will appear here. Seeded payments
                are illustrative records.
              </p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="documents" className="mt-6">
          <div className="grid gap-5 md:grid-cols-2">
            {plot.docs.map((d) => (
              <div
                key={d.name}
                className={d.status === "available" ? "surface p-6" : "surface-dashed p-6"}
              >
                <div className="flex items-start justify-between">
                  <FileText size={23} className="text-gold" />
                  <span
                    className={`status-dot ${d.status === "available" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}
                  >
                    {d.status === "available"
                      ? "Available"
                      : d.status === "review"
                        ? "Under review"
                        : "Pending"}
                  </span>
                </div>
                <h2 className="mt-4 text-xl">{d.name}</h2>
                <p className="mt-2 text-xs text-low">
                  {d.reviewer} · {d.reviewed || "Review not completed"}
                </p>
                <details className="mt-4 border-t border-border pt-3 text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    Version history
                  </summary>
                  <ul className="mt-3 space-y-3">
                    {DOC_HISTORY.map((h) => (
                      <li key={h.v}>
                        <span className="text-gold">{h.v}</span> · {h.change}
                        <p className="mt-1 text-low">
                          {h.date} · {h.actor} · Sample history
                        </p>
                      </li>
                    ))}
                  </ul>
                </details>
                {d.status === "available" && (
                  <Button
                    className="mt-4"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadText(
                        `${code}-${d.name}.txt`,
                        `MIRAI SAMPLE DOCUMENT\n${code}: ${d.name}\nReviewer role: ${d.reviewer}\nReviewed: ${d.reviewed}\nThis is an illustrative document summary, not a title instrument or proof of ownership.`,
                      )
                    }
                  >
                    <Download size={14} />
                    Download sample summary
                  </Button>
                )}
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="map" className="mt-6">
          <BeaconMap plot={plot} />
        </TabsContent>
        <TabsContent value="site" className="mt-6">
          <SiteChecks plot={plot} />
        </TabsContent>
        <TabsContent value="activity" className="mt-6 space-y-4">
          {receipts.map((receipt) => (
            <div key={receipt.id} className="surface p-5">
              <p className="text-sm">
                {receipt.kind} · {naira(receipt.amount)}
              </p>
              <p className="mt-2 text-xs text-low">
                {new Date(receipt.date).toLocaleString("en-NG")} · {receipt.id} · Local demo record
              </p>
            </div>
          ))}
          {ALERTS.filter((a) => a.code === code).map((a) => (
            <div key={a.id} className="surface p-5">
              <p className="text-sm">{a.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{a.body}</p>
              <p className="mt-2 text-xs text-low">{a.time} · Sample activity</p>
            </div>
          ))}
          {!receipts.length && !ALERTS.some((a) => a.code === code) && (
            <p className="surface p-5 text-sm text-muted-foreground">
              No activity has been recorded for this plot yet.
            </p>
          )}
        </TabsContent>
      </Tabs>
      <Dialog
        open={pay !== null}
        onOpenChange={(v) => {
          if (!v && !busy) setPay(null);
        }}
      >
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle className="text-2xl">Record a demo payment</DialogTitle>
            <DialogDescription>
              No real charge is made. This updates your local demo ledger.
            </DialogDescription>
          </DialogHeader>
          <div className="my-3 num text-4xl text-gold">
            {pay !== null ? naira(owned.instalments[pay]?.amount || 0) : ""}
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm">Payment method</legend>
            {["Card", "Bank transfer", "USSD"].map((m) => (
              <label key={m} className="surface flex min-h-12 items-center gap-3 p-3 text-sm">
                <input
                  type="radio"
                  name="method"
                  checked={method === m}
                  onChange={() => setMethod(m)}
                />
                {m}
              </label>
            ))}
          </fieldset>
          <Button disabled={busy} onClick={confirm}>
            {busy ? (
              <>
                <Loader2 className="animate-spin" />
                Processing…
              </>
            ) : (
              "Simulate payment"
            )}
          </Button>
          <p className="text-xs text-low">
            Live Paystack checkout requires a backend transaction and payment verification.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
