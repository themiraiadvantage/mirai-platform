"use client";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { costBreakdown, naira, RESERVATION_FEE, type Plot } from "@/lib/data";
import { StatusChip } from "./primitives";
export function ComparePlots({
  plots,
  open,
  onOpenChange,
  plotBase = "/plots",
}: {
  plots: Plot[];
  open: boolean;
  onOpenChange: (value: boolean) => void;
  plotBase?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto bg-card sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-3xl">Put the details side by side.</DialogTitle>
          <DialogDescription>
            Compare the evidence and the full upfront cost. All records are sample data.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Plot details</th>
                {plots.map((p) => (
                  <th key={p.code} className="font-mono text-gold">
                    {p.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Location", (p: Plot) => `${p.location}, ${p.state}`],
                ["Plot size", (p: Plot) => `${p.size} sqm`],
                ["Land price", (p: Plot) => naira(p.price)],
                [
                  "Outright ownership + access cost",
                  (p: Plot) =>
                    naira(costBreakdown(p.price).reduce((a, c) => a + c.amount, RESERVATION_FEE)),
                ],
                ["Verification", (p: Plot) => <StatusChip status={p.status} />],
                ["Site assessment", (p: Plot) => p.siteStatus],
                ["Documents", (p: Plot) => p.docSummary],
                [
                  "Missing assessment findings",
                  (p: Plot) =>
                    `${p.checks.filter((c) => c.result === "nodata").length} of ${p.checks.length}`,
                ],
                ["Plans", (p: Plot) => p.plans.map((s) => s.replace("mo", " months")).join(" · ")],
              ].map(([label, value]) => (
                <tr key={label as string}>
                  <td className="text-low">{label as string}</td>
                  {plots.map((p) => (
                    <td key={p.code}>{(value as (p: Plot) => React.ReactNode)(p)}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <td></td>
                {plots.map((p) => (
                  <td key={p.code}>
                    <Button variant="outline" asChild>
                      <Link href={`${plotBase}/${p.code}`}>View record →</Link>
                    </Button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
