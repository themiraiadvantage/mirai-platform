"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, MapPin } from "lucide-react";
import { PLOTS, naira } from "@/lib/data";

const featured = [PLOTS[0]!, PLOTS[6]!, PLOTS[1]!];
const grid = Array.from({ length: 9 }, (_, i) => ({ x: (i % 3) * 85, y: Math.floor(i / 3) * 85 }));

export function HeroSurvey() {
  const [selected, setSelected] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const plot = featured[selected]!;
  const outline =
    plot.shape.map(([x, y], i) => `${i ? "L" : "M"}${87 + x * 0.72} ${87 + y * 0.72}`).join(" ") +
    "Z";

  useEffect(() => {
    const element = ref.current!;
    const observer = new IntersectionObserver(([entry]) => {
      element.classList.toggle("survey-paused", !entry?.isIntersecting);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="hero-survey hero-enter relative min-w-0"
      style={{ animationDelay: "350ms" }}
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches)
          return;
        const bounds = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty(
          "--survey-x",
          `${(event.clientX - bounds.left - bounds.width / 2) * 0.025}px`,
        );
        event.currentTarget.style.setProperty(
          "--survey-y",
          `${(event.clientY - bounds.top - bounds.height / 2) * 0.025}px`,
        );
      }}
      onPointerLeave={(event) => {
        event.currentTarget.style.setProperty("--survey-x", "0px");
        event.currentTarget.style.setProperty("--survey-y", "0px");
      }}
    >
      <div className="mb-2 flex items-center justify-between px-4 font-mono text-xs uppercase tracking-[.14em] text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="hero-live-dot" /> Boundary preview
        </span>
        <span>Sample plot · {plot.code}</span>
      </div>
      <div className="survey-parallax">
        <svg
          viewBox="0 0 600 470"
          className="survey-scene w-full overflow-visible"
          role="img"
          aria-label={`Animated boundary illustration for ${plot.location}. Illustrative layout, not a survey plan.`}
        >
          <defs>
            <linearGradient id="survey-ground" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#254353" stopOpacity=".65" />
              <stop offset="1" stopColor="#00101a" stopOpacity=".2" />
            </linearGradient>
            <linearGradient id="survey-land" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#df9f53" stopOpacity=".5" />
              <stop offset="1" stopColor="#df9f53" stopOpacity=".12" />
            </linearGradient>
            <clipPath id="survey-clip">
              <path d={outline} />
            </clipPath>
          </defs>
          <ellipse cx="300" cy="352" rx="230" ry="65" fill="#000a11" opacity=".5" />
          <g className="survey-terrain">
            <path
              d="M45 262L300 145L555 262V284L300 402L45 284Z"
              fill="#102934"
              stroke="#365362"
              strokeOpacity=".6"
            />
            <g transform="matrix(1 .46 -1 .46 300 145)">
              <rect
                width="255"
                height="255"
                fill="url(#survey-ground)"
                stroke="#6b8a9b"
                strokeOpacity=".5"
              />
              {grid.map(
                ({ x, y }, i) =>
                  i !== 4 && (
                    <path
                      key={i}
                      d={`M${x + 6} ${y + 6}h73v73h-73Z`}
                      fill="#668796"
                      fillOpacity={i % 3 === 0 ? ".12" : ".05"}
                      stroke="#7893a1"
                      strokeOpacity=".3"
                      strokeWidth=".8"
                    />
                  ),
              )}
              {[85, 170].map((n) => (
                <path
                  key={n}
                  d={`M${n} 0V255M0 ${n}H255`}
                  stroke="#df9f53"
                  strokeOpacity=".25"
                  strokeDasharray="3 5"
                />
              ))}
              <g key={plot.code}>
                <path
                  d={outline}
                  fill="url(#survey-land)"
                  stroke="#df9f53"
                  strokeWidth="2"
                  className="survey-boundary"
                />
                <path
                  d={outline}
                  fill="none"
                  stroke="#fff0d9"
                  strokeWidth="1.2"
                  strokeDasharray="10 160"
                  className="survey-trace"
                />
                <g clipPath="url(#survey-clip)">
                  <rect
                    x="82"
                    y="85"
                    width="95"
                    height="14"
                    fill="#ffe1ad"
                    opacity=".3"
                    className="survey-scan"
                  />
                </g>
                {plot.shape.map(([x, y], i) => (
                  <g key={i}>
                    <circle
                      cx={87 + x * 0.72}
                      cy={87 + y * 0.72}
                      r="5"
                      fill="#df9f53"
                      className="animate-beacon"
                      style={{ animationDelay: `${i * 320}ms` }}
                    />
                    <circle cx={87 + x * 0.72} cy={87 + y * 0.72} r="2.3" fill="#fff5e8" />
                  </g>
                ))}
              </g>
            </g>
            <path
              d="M300 145V87M45 262V220M555 262V220"
              stroke="#df9f53"
              strokeOpacity=".35"
              strokeDasharray="3 5"
            />
            <circle cx="300" cy="87" r="4" fill="#df9f53" />
            <path d="M285 87h-22M315 87h22M300 72V57" stroke="#df9f53" strokeOpacity=".65" />
            <text
              x="300"
              y="44"
              fill="#bac6ce"
              fontSize="10"
              textAnchor="middle"
              fontFamily="monospace"
              letterSpacing="2"
            >
              YOUR NEXT CHAPTER
            </text>
            <text
              x="300"
              y="433"
              fill="#718d9e"
              fontSize="9"
              textAnchor="middle"
              fontFamily="monospace"
              letterSpacing="2"
            >
              MAPPED. CHECKED. READY TO EXPLORE.
            </text>
          </g>
        </svg>
      </div>
      <div className="survey-record relative mx-3 -mt-5 rounded-2xl border border-white/15 bg-[#10232f]/90 p-5 backdrop-blur-xl sm:mx-7">
        <div key={plot.code} className="animate-rise flex items-start justify-between gap-3">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin size={12} /> {plot.location}, {plot.state}
            </p>
            <p className="font-display text-2xl text-white">
              {plot.size} sqm{" "}
              <span className="font-sans text-xs text-muted-foreground">/ {plot.code}</span>
            </p>
          </div>
          <Link
            href={`/plots/${plot.code}`}
            aria-label={`View plot ${plot.code}`}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-gold/40 text-gold transition-colors hover:bg-gold hover:text-marine-deep"
          >
            <ArrowUpRight size={20} />
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <span className="text-sm text-gold">{naira(plot.price)}</span>
          <div className="flex gap-1.5" aria-label="Featured locations">
            {featured.map((item, i) => (
              <button
                key={item.code}
                type="button"
                aria-pressed={selected === i}
                onClick={() => setSelected(i)}
                className={`min-h-9 rounded-full border px-3 text-xs transition-colors ${selected === i ? "border-gold/50 bg-gold/10 text-gold" : "border-white/10 text-muted-foreground hover:border-white/40 hover:text-white"}`}
              >
                {item.location}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
