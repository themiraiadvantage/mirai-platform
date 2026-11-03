import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RESERVATION_FEE, naira } from "@/lib/data";

export default function Page() {
  return (
    <>
      <p className="eyebrow">Before your next step</p>
      <h1 className="page-title">Your buying guide</h1>
      <p className="page-subtitle">
        What to review, what to pay, and how your ownership record grows.
      </p>
      <div className="mt-8 space-y-6">
        <section className="surface p-6">
          <h2 className="text-2xl">From discovery to ownership</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-2">
            {[
              [
                "Discover",
                "Compare plots by location, size, price, payment plan and verification status.",
              ],
              [
                "Review",
                "Read the boundary map, survey beacons, documents and site findings before committing.",
              ],
              [
                "Reserve",
                "Review the fee, access period, cancellation terms and consent before payment.",
              ],
              [
                "Verify",
                "Review the document checks, site status and outstanding issues. Ask for specialist evidence where needed.",
              ],
              [
                "Pay",
                "Choose an eligible outright, three-month or six-month plan. Keep every receipt.",
              ],
              [
                "Track",
                "Use your Land Library for balances, due dates, documents, progress and alerts.",
              ],
              [
                "Complete",
                "Receive final ownership documents once payment, legal and administrative requirements are confirmed.",
              ],
            ].map(([title, copy], i) => (
              <li key={title} className="rounded-xl border border-border p-4">
                <h3 className="text-sm font-medium">
                  <span className="mr-2 text-gold">0{i + 1}</span>
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
              </li>
            ))}
          </ol>
          <Button asChild className="mt-6">
            <Link href="/dashboard/explore">Explore plots</Link>
          </Button>
        </section>
        <section id="fees" className="surface scroll-mt-24 p-6">
          <h2 className="text-2xl">Fees, plans & reservation access</h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            The proposed reservation and access fee is {naira(RESERVATION_FEE)} for 12 months of
            location and document access. Renewal, eligibility and refund terms require final
            confirmation. Land payments are separate from this fee. Each plot lists its available
            plans, legal, survey and documentation costs before checkout.
          </p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Read the cancellation and refund terms in the reservation screen. Keep the payment
            reference and contact support about cancellations, missed payments or disputes. Checkout
            is a simulation; no money moves and no plot is legally allocated. Paystack is the
            proposed gateway, pending integration and confirmation.
          </p>
        </section>
        <section id="checks" className="surface scroll-mt-24 p-6">
          <h2 className="text-2xl">Understanding verification & site checks</h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            A document being available does not mean ownership is complete. Check its review date,
            reviewer and history. Site assessments cover flooding, height and slope, drainage, soil,
            road access, land-use limits, surroundings, climate and site visits. Each finding needs
            a source, date, reviewer, method and next action. Missing information stays marked as
            not enough data; a desk check does not replace legal review or a specialist visit.
          </p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Site screening and field evidence are planned features. Current records are
            illustrative. Sources, sign-off rules and update schedules still need confirmation. Land
            values can rise or fall; MIRAI makes no return guarantees.
          </p>
        </section>
        <section className="surface p-6">
          <h2 className="text-2xl">Co-ownership & your records</h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            The proposed model matches two buyers for one plot over three months. Review
            contributions, allocation, missed payments, exit, refunds and disputes before any
            deposit. Matching and allocation require confirmation and reviewed agreements; the
            current workflow is a simulation. Your profile and notification preferences are
            available from the top bar. Property records currently stay in this browser; durable
            storage and document access controls are pending.
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-sm">
            <Link className="underline" href="/dashboard/co-own">
              View co-ownership
            </Link>
            <Link className="underline" href="/dashboard/profile">
              Open profile
            </Link>
            <a className="underline" href="mailto:hello@mirai.ng">
              Contact support
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
