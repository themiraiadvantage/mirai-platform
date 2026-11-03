"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, FileWarning, Ruler, Wallet, KeyRound } from "lucide-react";
import { Steps } from "@/components/mirai/Steps";
import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/mirai/SiteChrome";
import { Hero } from "@/components/mirai/Hero";
import { FeaturedPlots } from "@/features/plots/FeaturedPlots";
import { SectionTitle } from "@/components/mirai/primitives";
import { BuyingClarity, PaymentOptions, BuyerQuestions, FinalInvitation } from "./LandingSections";

function Counter({
  to,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setV(to);
        return;
      }
      const t0 = performance.now();
      const tick = (t: number) => {
        const k = Math.min((t - t0) / 1600, 1);
        setV(to * (1 - (1 - k) ** 3));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(ref.current!);
    return () => io.disconnect();
  }, [to]);
  return (
    <span ref={ref} className="num">
      {prefix}
      {v.toLocaleString("en-NG", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

function TrustStrip() {
  const items: {
    value: number;
    label: string;
    prefix?: string;
    suffix?: string;
    decimals?: number;
  }[] = [
    { value: 1200, suffix: "+", label: "Buyers supported" },
    {
      value: 850,
      suffix: "+",
      label: "Site visits completed",
    },
    {
      value: 2400,
      suffix: "+",
      label: "Plot records organised",
    },
    {
      value: 3600,
      suffix: "+",
      label: "Documents reviewed",
    },
  ];
  return (
    <section className="estate-hero-metrics" aria-label="MIRAI at a glance">
      <dl>
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd className="estate-metric-number">
              <Counter
                to={item.value}
                prefix={item.prefix}
                suffix={item.suffix}
                decimals={item.decimals}
              />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const fears = [
  {
    icon: FileWarning,
    fear: "Fake documents",
    answer:
      "Every document is reviewed by a named role, dated, and shown with its status, before you pay a kobo beyond reservation.",
  },
  {
    icon: Ruler,
    fear: "Unclear boundaries",
    answer:
      "Survey beacons with GPS coordinates, a boundary map and a site visit record for every plot.",
  },
  {
    icon: Wallet,
    fear: "Money disappearing",
    answer:
      "A payment ledger with receipts for every instalment, tracked against your plot record.",
  },
  {
    icon: KeyRound,
    fear: "Never receiving allocation",
    answer:
      "A visible stage-by-stage progress record from reservation to deed, with alerts at each step.",
  },
];

function Pain() {
  return (
    <section id="discover" className="estate-section estate-confidence" data-reveal>
      <div className="estate-confidence-intro">
        <p className="estate-eyebrow">Know what you’re buying</p>
        <h2>
          The fear isn't paying.
          <br />
          <span>It's paying and regretting it.</span>
        </h2>
        <p>
          Your boundaries, documents, payments and progress. Together in one record, from the first
          step.
        </p>
        <Link href="/how-it-works" className="estate-inline-link">
          A clearer way to own land <ArrowRight size={17} />
        </Link>
      </div>
      <div className="estate-confidence-list">
        {fears.map((f, i) => (
          <article key={f.fear}>
            <span className="estate-index">0{i + 1}</span>
            <div>
              <h3>{f.fear}</h3>
              <p>{f.answer}</p>
            </div>
            <f.icon size={21} strokeWidth={1.3} />
          </article>
        ))}
      </div>
    </section>
  );
}

export default function Index() {
  useLandingReveal();
  return (
    <div className="landing-page">
      <PublicLayout>
        <Hero />
        <TrustStrip />
        <BuyingClarity />
        <Pain />
        <section id="trust" className="estate-section estate-process" data-reveal>
          <SectionTitle
            eyebrow="How it works"
            title="7 steps. One record. No surprises."
            sub="Every plot shows what has been checked, by whom, and when."
          />
          <Steps />
        </section>
        <section className="estate-section estate-catalogue" data-reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionTitle eyebrow="Catalogue" title="Plots open now" />
            <Button variant="outline" asChild>
              <Link href="/plots">
                Explore all plots <ArrowRight />
              </Link>
            </Button>
          </div>
          <FeaturedPlots />
        </section>
        <PaymentOptions />
        <BuyerQuestions />
        <FinalInvitation />
      </PublicLayout>
    </div>
  );
}

function useLandingReveal() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sections = document.querySelectorAll(".landing-page [data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.remove("estate-reveal-pending");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08 },
    );
    sections.forEach((section) => {
      section.classList.add("estate-reveal-pending");
      observer.observe(section);
    });
    return () => {
      observer.disconnect();
      sections.forEach((section) => section.classList.remove("estate-reveal-pending"));
    };
  }, []);
}
