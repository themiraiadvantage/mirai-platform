"use client";
import Link from "next/link";
import { MapPin, FileCheck2, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Plot, naira } from "@/lib/data";
import { ParcelSvg, StatusChip } from "./primitives";
import { toggleSaved, useDemo } from "@/lib/demo-store";
import { plotPhoto } from "@/lib/photos";

export function PlotCard({
  plot,
  i = 0,
  onCompare,
  compared = false,
  plotBase = "/plots",
}: {
  plot: Plot;
  i?: number;
  onCompare?: (code: string) => void;
  compared?: boolean;
  plotBase?: string;
}) {
  const demo = useDemo();
  return (
    <article
      className="surface lift group flex animate-rise flex-col overflow-hidden"
      style={{ animationDelay: `${i * 40}ms` }}
    >
      <div className="relative h-44 overflow-hidden border-b border-border">
        <img
          src={plotPhoto(plot.photo)}
          alt={`Land at ${plot.location}, ${plot.state}`}
          loading="lazy"
          width={1280}
          height={800}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <ParcelSvg
          shape={plot.shape}
          beacons={false}
          className="absolute bottom-2 right-2 h-12 w-12 rounded-md bg-background/70 p-1"
        />
        <button
          aria-label={demo?.saved.includes(plot.code) ? "Unsave plot" : "Save plot"}
          aria-pressed={demo?.saved.includes(plot.code) || false}
          onClick={() => toggleSaved(plot.code)}
          className="absolute bottom-3 left-3 grid size-11 place-items-center rounded-xl border border-white/20 bg-background/80 text-gold"
        >
          <Bookmark size={17} fill={demo?.saved.includes(plot.code) ? "currentColor" : "none"} />
        </button>
        <span className="absolute left-3 top-3 rounded-md bg-background/70 px-2 py-0.5 font-mono text-xs text-gold">
          {plot.code}
        </span>
        <StatusChip status={plot.status} className="absolute right-3 top-3 bg-card shadow-sm" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />
              {plot.location}, {plot.state}
            </div>
            <div className="mt-1 num text-sm text-low">{plot.size} sqm</div>
          </div>
          <div className="num font-display text-2xl">{naira(plot.price)}</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {plot.plans.map((p) => (
            <span
              key={p}
              className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground"
            >
              {p === "Outright" ? "Outright" : p.replace("mo", " months")}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-low">
          <FileCheck2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          {plot.docSummary}
        </div>
        {onCompare && (
          <label className="flex min-h-11 cursor-pointer items-center gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={compared} onChange={() => onCompare(plot.code)} />
            Compare this plot
          </label>
        )}
        <Button asChild variant="secondary" className="mt-auto">
          <Link href={`${plotBase}/${plot.code}`}>View plot record</Link>
        </Button>
      </div>
    </article>
  );
}
