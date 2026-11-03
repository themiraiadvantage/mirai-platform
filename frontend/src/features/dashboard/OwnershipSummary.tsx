import Link from "next/link";
import type { Owned, Plot } from "@/lib/data";
import { RESERVATION_FEE, naira, planSchedule, STAGES } from "@/lib/data";
import { Button } from "@/components/ui/button";

export function OwnershipSummary({ plot, owned }: { plot: Plot; owned: Owned }) {
  const total = planSchedule(plot.price, owned.plan).total;
  const next = owned.instalments.find((i) => i.status !== "Paid");
  const issues = plot.checks.filter((c) => c.result !== "ok");
  const pendingDocs = plot.docs.filter((d) => d.status !== "available");
  const date = (value?: string) =>
    value ? new Date(value).toLocaleDateString("en-NG") : "Not recorded";
  const actions = {
    Reservation: "Review the document and site checks, then review your payment schedule.",
    Payment:
      owned.paid >= total
        ? "Land payments are recorded. Resolve any outstanding verification and final documentation with the review team."
        : "Review the next amount due and keep a receipt for each payment.",
    Verification: "Resolve outstanding document and site issues with the assigned reviewers.",
    Documentation: "Review the final agreements, survey and deed with the legal team.",
    Complete: "Keep the final signed documents and the complete ownership history.",
  };
  return (
    <div className="space-y-6">
      <section className="surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl">Your next step</h2>
          <span className="text-xs text-gold">
            {(STAGES.indexOf(owned.stage) + 1) * 20}% workflow progress
          </span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{actions[owned.stage]}</p>
        <p className="mt-2 text-xs text-low">
          Progress reflects the recorded purchase stage, not a legal ownership percentage.
        </p>
        <dl className="mt-6 grid gap-5 sm:grid-cols-3">
          {[
            ["Land balance", naira(Math.max(0, total - owned.paid))],
            ["Next amount due", next ? naira(next.amount) : "No outstanding land payment"],
            ["Due date", next ? next.due : "No payment due"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-low">{label}</dt>
              <dd className="mt-2 text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface p-6">
          <h2 className="text-2xl">Reservation & access</h2>
          <dl className="mt-5 space-y-4 text-sm">
            {[
              ["Proposed reservation/access fee", naira(RESERVATION_FEE)],
              ["Reservation recorded", date(owned.reservedAt)],
              ["12-month access ends", date(owned.accessExpiresAt)],
              ["Renewal", "Subject to confirmed terms; no automatic charge"],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-xs leading-6 text-low">
            Reservation holds and access dates are illustrative. A reservation is not ownership.
            Commercial terms require confirmation.
          </p>
          <Link className="mt-4 inline-block text-xs underline" href="/dashboard/guide#fees">
            Fees, renewal & cancellation guidance
          </Link>
        </section>
        <section className="surface p-6">
          <h2 className="text-2xl">Verification & open issues</h2>
          <p className="mt-3 text-sm text-muted-foreground">Site status: {plot.siteStatus}</p>
          <p className="mt-3 text-sm">
            {pendingDocs.length} documents awaiting review or availability · {issues.length} site
            findings need follow-up
          </p>
          <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
            {pendingDocs.map((d) => (
              <li key={d.name}>
                {d.name}: {d.status === "review" ? "Under review" : "Pending"} · {d.reviewer}
              </li>
            ))}
            {issues.map((c) => (
              <li key={c.key}>
                {c.label}:{" "}
                {c.result === "nodata" ? "Not enough data" : "Further checking recommended"}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-6 text-low">
            Use the document and site tabs for dated sources, reviewer roles, methods and next
            actions. Real verification sign-off is pending.
          </p>
        </section>
      </div>
      <section className="surface p-6">
        <h2 className="text-2xl">Completion & final ownership record</h2>
        <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
          <li>
            Land payment:{" "}
            {owned.paid >= total ? "Recorded as paid in the demo ledger" : "Outstanding balance"}
          </li>
          <li>Final survey, title, agreement and deed: awaiting confirmed signed documents</li>
          <li>Legal and administrative completion: awaiting professional confirmation</li>
          <li>Permanent digital record: backend storage and final document delivery pending</li>
        </ul>
        <p className="mt-4 text-xs text-low">
          Paying the balance does not automatically complete ownership.
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link href={`/dashboard/explore/${plot.code}`}>Review full plot details</Link>
        </Button>
      </section>
    </div>
  );
}
