import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Mail, Scale, ShieldCheck } from "lucide-react";
import { PublicLayout } from "./SiteChrome";
import { COMPANY, POLICY_UPDATED } from "@/lib/company";

export type PolicySection = { id: string; title: string; content: ReactNode };

export function PolicyPage({
  kind,
  title,
  introduction,
  summary,
  sections,
}: {
  kind: "privacy" | "terms";
  title: string;
  introduction: string;
  summary: string[];
  sections: PolicySection[];
}) {
  const Icon = kind === "privacy" ? ShieldCheck : Scale;
  const other =
    kind === "privacy"
      ? { href: "/terms", title: "Terms of Service" }
      : { href: "/privacy", title: "Privacy Policy" };
  const contents = sections.map((section, index) => (
    <li key={section.id}>
      <a
        href={`#${section.id}`}
        className="group flex min-h-10 items-start gap-3 rounded-lg px-2 py-2 text-xs leading-5 text-muted-foreground transition-colors hover:bg-overlay hover:text-foreground"
      >
        <span className="w-4 shrink-0 text-xs text-gold">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span>{section.title}</span>
      </a>
    </li>
  ));
  return (
    <PublicLayout>
      <header className="marine-surface border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-12 md:py-16">
          <div className="mb-8 flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/" className="transition-colors hover:text-white">
              Home
            </Link>
            <span aria-hidden="true">/</span>
            <span>Legal</span>
          </div>
          <div className="flex items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[.22em] text-brand-gold">
                Clarity builds confidence
              </p>
              <h1 className="text-4xl font-semibold leading-tight tracking-[-.04em] sm:text-5xl md:text-6xl">
                {title}
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                {introduction}
              </p>
              <p className="mt-7 text-xs text-muted-foreground">
                Last updated{" "}
                <time dateTime="2026-10-21" className="text-white">
                  {POLICY_UPDATED}
                </time>
              </p>
            </div>
            <span className="hidden size-16 shrink-0 place-items-center rounded-2xl border border-brand-gold/25 bg-brand-gold/10 text-brand-gold sm:grid">
              <Icon size={30} strokeWidth={1.3} />
            </span>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-16 lg:py-16">
        <aside className="min-w-0">
          <div className="lg:sticky lg:top-24">
            <details className="rounded-xl border border-border px-4 py-3 lg:hidden">
              <summary className="cursor-pointer text-sm font-semibold">On this page</summary>
              <nav aria-label={`${title} contents`} className="mt-3">
                <ol className="grid gap-1">{contents}</ol>
              </nav>
            </details>
            <nav className="hidden lg:block" aria-label={`${title} contents`}>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">
                On this page
              </p>
              <ol className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">{contents}</ol>
            </nav>
            <div className="mt-7 rounded-xl border border-border bg-overlay/50 p-4">
              <Mail className="mb-3 size-5 text-gold" />
              <p className="text-sm font-semibold">A question about this policy?</p>
              <a
                href={`mailto:${COMPANY.supportEmail}`}
                className="mt-2 block break-all text-xs leading-6 text-muted-foreground underline decoration-brand-gold/50 underline-offset-4"
              >
                {COMPANY.supportEmail}
              </a>
            </div>
          </div>
        </aside>
        <article className="min-w-0 max-w-3xl">
          <div className="mb-10 rounded-2xl border border-brand-gold/25 bg-brand-gold/5 p-6 sm:p-7">
            <h2 className="text-lg font-semibold">The essentials</h2>
            <ul className="mt-4 space-y-3">
              {summary.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm leading-7 text-muted-foreground"
                >
                  <span className="mt-3 size-1 shrink-0 rounded-full bg-brand-gold" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-10">
            {sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-title`}
                className="scroll-mt-28 border-t border-border pt-8"
              >
                <h2
                  id={`${section.id}-title`}
                  className="flex items-baseline gap-3 text-xl font-semibold leading-8 tracking-tight sm:text-2xl"
                >
                  <span className="shrink-0 text-xs font-normal text-gold">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground [&_a]:break-words [&_a]:text-foreground [&_a]:underline [&_a]:decoration-brand-gold/60 [&_a]:underline-offset-4 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                  {section.content}
                </div>
              </section>
            ))}
          </div>
          <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-xs">
            <Link href={other.href} className="inline-flex min-h-11 items-center gap-2 font-medium">
              {other.title}
              <ArrowUpRight size={15} />
            </Link>
            <a
              href="#main-content"
              className="inline-flex min-h-11 items-center text-muted-foreground"
            >
              Back to top ↑
            </a>
          </footer>
        </article>
      </div>
    </PublicLayout>
  );
}
