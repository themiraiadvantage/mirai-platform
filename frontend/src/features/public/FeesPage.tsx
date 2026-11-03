"use client";
import Link from "next/link";
import { PublicLayout } from "@/components/mirai/SiteChrome";
import { Button } from "@/components/ui/button";
import { RESERVATION_FEE, naira } from "@/lib/data";

const SECTIONS = [
  {
    id: "reservation",
    t: "Reservation & access fee",
    body: [
      `A one-off ${naira(RESERVATION_FEE)} holds the plot in your name while checks complete.`,
      "It includes 12 months of live location view and document access.",
      "If you haven't started payment after 12 months, it renews at the same fee. We remind you 30 days before.",
    ],
  },
  {
    id: "costs",
    t: "Ownership costs",
    table: [
      ["Land price", "As listed on each plot"],
      ["Legal fees", "5% of the land price"],
      ["Documentation", naira(250000) + " (deed preparation & registration)"],
      ["Survey", naira(350000) + " (survey plan in your name)"],
    ],
  },
  {
    id: "plans",
    t: "Payment plans",
    table: [
      ["Outright", "One payment, no extra cost"],
      ["3 months", "Equal monthly instalments, no extra cost"],
      ["6 months", "Equal monthly instalments + 5% plan cost, shown upfront"],
    ],
  },
  {
    id: "late",
    t: "Late or missed payments",
    body: [
      "We remind you 7 and 2 days before each due date by email, SMS or WhatsApp.",
      "If you miss a payment we contact you to agree a new date. No hidden penalty fees are ever added.",
      "After 90 days without contact we may pause the plan and refund under the rules below.",
    ],
  },
  {
    id: "refunds",
    t: "Refunds & cancellation",
    body: [
      "Reservation fee: full refund within 14 days if any document we marked Verified turns out invalid.",
      "Personal cancellation within 14 days: 50% of the reservation fee refunded. After 14 days it covers access already used.",
      "Instalments: refunded minus documented legal and survey costs, itemised in writing, within 21 working days.",
    ],
  },
  {
    id: "coown",
    t: "Co-ownership deposits",
    body: [
      "Deposit is fully refundable if no partner is matched within 90 days.",
      "After a match, exit and dispute rules on the Co-own page apply.",
    ],
  },
  {
    id: "privacy",
    t: "Privacy & your data",
    body: [
      "Account registration and email verification use the connected authentication service. See the Privacy Policy for details.",
      "Property preview records and workspace preferences are stored in this browser. Account details and authentication records are held separately on the server.",
      "Clearing browser storage removes local records, but does not delete your account. Contact futurewithmirai@gmail.com for privacy or account-deletion requests.",
    ],
  },
];

export default function Page() {
  return (
    <PublicLayout>
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-[220px_1fr]">
        <nav className="h-fit space-y-1 text-sm lg:sticky lg:top-24" aria-label="Contents">
          <div className="mb-3 text-xs uppercase tracking-[0.2em] text-gold">Contents</div>
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="block rounded-md px-2 py-1.5 text-muted-foreground hover:bg-overlay hover:text-foreground"
            >
              {s.t}
            </a>
          ))}
        </nav>
        <div>
          <h1 className="text-5xl">Fees & policies</h1>
          <p className="mt-4 text-xs text-gold">
            Sample commercial terms for demonstration. No real transaction is available.
          </p>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Everything you could pay, and every way you can get money back, in plain words, before
            any payment.
          </p>
          <div className="mt-10 space-y-6">
            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="surface scroll-mt-24 p-6">
                <h2 className="text-2xl">{s.t}</h2>
                {s.body && (
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {s.body.map((b) => (
                      <li key={b}>· {b}</li>
                    ))}
                  </ul>
                )}
                {s.table && (
                  <table className="mt-3 w-full text-sm">
                    <tbody>
                      {s.table.map(([a, b]) => (
                        <tr key={a} className="border-t border-border">
                          <td className="py-2.5">{a}</td>
                          <td className="num py-2.5 text-right text-muted-foreground">{b}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            ))}
          </div>
          <p className="mt-8 text-xs text-low">
            MIRAI is a technology platform, not an estate agency or investment scheme. Land values
            can go up or down; we make no return guarantees.
          </p>
          <Button asChild className="mt-6">
            <Link href="/plots">Browse plots</Link>
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
}
