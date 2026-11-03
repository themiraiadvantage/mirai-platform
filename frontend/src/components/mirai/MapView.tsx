"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { Plot } from "@/lib/data";
import { ParcelSvg } from "./primitives";
const LandMap = dynamic(() => import("./LandMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full animate-pulse bg-overlay" role="status" aria-label="Loading map" />
  ),
});
export function MapView(props: {
  plots: Plot[];
  focus?: string;
  onSelect?: (code: string) => void;
  className?: string;
}) {
  const [abstract, setAbstract] = useState(false);
  return (
    <div className="relative h-full min-h-64 w-full">
      <button
        className="absolute right-3 top-3 z-[450] rounded-lg border border-border bg-background px-3 py-2 text-xs"
        onClick={() => setAbstract(!abstract)}
      >
        {abstract ? "Satellite map" : "Boundary fallback"}
      </button>
      {abstract ? (
        <div className="contour-bg flex h-full flex-wrap items-center justify-center gap-4 overflow-auto bg-card p-10">
          {props.plots.map((p) => (
            <button
              key={p.code}
              onClick={() => props.onSelect?.(p.code)}
              className="w-32 rounded-xl border border-border p-3 text-xs"
            >
              <ParcelSvg shape={p.shape} />
              {p.code} · {p.location}
            </button>
          ))}
        </div>
      ) : (
        <LandMap {...props} />
      )}
    </div>
  );
}
