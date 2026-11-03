import { ArrowRight } from "lucide-react";

export const STEPS = [
  {
    t: "Discover",
    d: "Browse plots with confirmed and pending details clearly separated.",
  },
  {
    t: "Review",
    d: "Read every document status, site check and cost before paying.",
  },
  {
    t: "Reserve",
    d: "Hold a plot for ₦30,000 with 12 months of live location access.",
  },
  {
    t: "Verify",
    d: "Our reviewers and field team complete outstanding checks.",
  },
  {
    t: "Pay",
    d: "Pay outright or over 3 or 6 months by card, transfer or USSD.",
  },
  { t: "Track", d: "Follow payments, documents and alerts in your Land Library." },
  { t: "Complete", d: "Receive your deed and full ownership record." },
];

export function Steps() {
  return (
    <ol
      className="ownership-steps mt-10 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-fr"
      aria-label="Steps to land ownership"
    >
      {STEPS.map((s, i) => (
        <li
          key={s.t}
          id={`ownership-step-${i + 1}`}
          tabIndex={-1}
          className={`group relative flex min-w-0 scroll-mt-24 animate-rise flex-col rounded-2xl border p-6 transition-colors sm:p-7 ${i === STEPS.length - 1 ? "marine-surface border-marine-deep" : "border-border bg-card hover:border-brand-gold/50"}`}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <p className="ownership-step-number">
            <span className="sr-only">Step </span>
            {String(i + 1).padStart(2, "0")}
          </p>
          <h3 className="text-2xl">{s.t}</h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{s.d}</p>
          {i < STEPS.length - 1 && (
            <span
              className={`ownership-step-arrow ${i === 3 ? "ownership-step-arrow-turn" : ""}`}
              aria-hidden="true"
            >
              <ArrowRight size={22} strokeWidth={1.3} />
            </span>
          )}
          {i === 3 && (
            <svg
              className="ownership-row-connector"
              viewBox="0 0 1000 44"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M1000 0 V12 Q1000 22 990 22 H10 Q0 22 0 32 V43 M-4 38 L0 43 L4 38"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
        </li>
      ))}
    </ol>
  );
}
