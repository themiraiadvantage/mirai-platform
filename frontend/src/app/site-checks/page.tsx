import Link from "next/link";
import {
  ShieldCheck,
  Droplets,
  Ruler,
  Route,
  Microscope,
  CalendarDays,
  ArrowUpRight,
} from "lucide-react";
import { PublicLayout } from "@/components/mirai/SiteChrome";
import { SectionTitle } from "@/components/mirai/primitives";
export const metadata = { title: "How site checks work" };
export default function Page() {
  return (
    <PublicLayout>
      <section className="contour-bg border-b border-border">
        <div className="mx-auto max-w-7xl px-5 py-20">
          <p className="eyebrow">Confidence has a paper trail</p>
          <h1 className="max-w-3xl text-5xl leading-tight md:text-7xl">
            A checked box should
            <br />
            come with <em className="text-gold">context.</em>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Know what we looked at, who reviewed it, and where the evidence ends. A site assessment
            is a starting point for better decisions.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-20">
        <SectionTitle
          eyebrow="The evidence behind the record"
          title="A source. A date. A person responsible."
          sub="Every sample assessment follows the same structure, so you can compare coverage without confusing missing information with a positive finding."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            [
              Droplets,
              "Water & drainage",
              "Flood outlooks, nearby waterways and visible drainage. Regional data may miss local conditions.",
            ],
            [
              Ruler,
              "Ground & boundaries",
              "Approximate elevation, slope and beacon records. Engineering tests and licensed surveys are separate.",
            ],
            [
              Route,
              "Access & surroundings",
              "Road access, adjacent uses and field notes. Conditions can change with season and construction.",
            ],
          ].map(([Icon, title, copy]) => {
            const I = Icon as typeof Droplets;
            return (
              <div key={String(title)} className="surface p-7">
                <I size={28} className="text-gold" />
                <h2 className="mt-5 text-2xl">{String(title)}</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{String(copy)}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="surface p-7">
            <Microscope className="text-primary-bright" />
            <h2 className="mt-4 text-3xl">When to ask a specialist</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              A desk review cannot establish soil bearing capacity, drainage design, structural
              suitability or legal title. If findings conflict, coverage is limited, or you plan to
              build, seek the relevant licensed professional before committing.
            </p>
          </div>
          <div className="surface-dashed p-7">
            <CalendarDays className="text-warning" />
            <h2 className="mt-4 text-3xl">“Not enough data” is an answer.</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              We show missing and outdated evidence explicitly. A completed visit means the
              documented visit took place; it is not a promise about future site conditions.
            </p>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-gold/20 bg-gold/5 p-7">
          <p className="max-w-2xl text-sm text-muted-foreground">
            This frontend uses simulated findings and coordinates. Referenced sources illustrate the
            evidence format and have not been consulted to verify these sample plots.
          </p>
          <Link href="/plots" className="flex items-center gap-2 text-sm text-gold">
            Explore sample records <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
