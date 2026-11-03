"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Search, MapPin, Bookmark } from "lucide-react";
import { useDemo, toggleSaved } from "@/lib/demo-store";
import { PLOTS, getPlot, STAGES, naira } from "@/lib/data";
import { EmptyState, ParcelSvg, ProgressRing, StatusChip } from "@/components/mirai/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CoOwnershipRecords } from "./CoOwnershipRecords";
import { usePropertyResource, type CoSummary } from "@/lib/property-api";
import { ReservationRecords } from "./ReservationRecords";
import type { ReservationPage } from "@/lib/reservation-api";
import { SavedPlotsGrid } from "./SavedPlotsGrid";
import { useSavedPlots } from "@/components/mirai/SavedPlots";
import { NIGERIA_STATES } from "@/lib/nigeria-map";
export default function Library() {
  const savedPlots = useSavedPlots();
  const reservations = usePropertyResource<ReservationPage>("/reservations");
  const reservationCount = reservations.data?.stats.active || 0;
  const coSummary = usePropertyResource<CoSummary>("/co-ownership/summary");
  const coCount = (coSummary.data?.active || 0) + (coSummary.data?.allocated || 0);
  const demo = useDemo(),
    [q, setQ] = useState(""),
    [state, setState] = useState(""),
    [stage, setStage] = useState(""),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    setQ(new URLSearchParams(window.location.search).get("q") || "");
  }, []);
  const list = (demo?.owned || []).map((o) => getPlot(o.code)!);
  const filtered = list.filter(
    (p) =>
      (!state || p.state === state) &&
      (!stage || demo?.owned.find((o) => o.code === p.code)?.stage === stage) &&
      (p.code + p.location).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <p className="eyebrow">A place for every plot</p>
      <h1 className="page-title">Your Land Library</h1>
      <p className="page-subtitle">
        The complete picture of your land. From first reservation to final deed.
      </p>
      <div className="mt-8 flex gap-6 border-b border-border">
        <button
          className={`pb-4 text-sm ${!saved ? "border-b-2 border-gold text-gold" : "text-low"}`}
          onClick={() => setSaved(false)}
        >
          Owned & reserved{" "}
          <span className="ml-2 text-xs">
            {(demo?.owned.length || 0) + coCount + reservationCount}
          </span>
        </button>
        <button
          className={`pb-4 text-sm ${saved ? "border-b-2 border-gold text-gold" : "text-low"}`}
          onClick={() => {
            setSaved(true);
            setStage("");
          }}
        >
          Saved plots{" "}
          <span className="ml-2 text-xs">{savedPlots.loading ? "…" : savedPlots.ids.length}</span>
        </button>
      </div>
      <div className="my-6 flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          aria-label="Search library"
          placeholder="Search plot code or location…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Filter state"
          className="filter-select"
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          <option value="">All states</option>
          {NIGERIA_STATES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        {!saved && (
          <select
            aria-label="Filter stage"
            className="filter-select"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
      </div>
      {!saved && (
        <>
          <ReservationRecords libraryFilters={{ query: q, state, stage }} />
          <CoOwnershipRecords libraryFilters={{ query: q, state, stage }} />
        </>
      )}
      {saved && (
        <SavedPlotsGrid
          query={q}
          state={state}
          clearFilters={() => {
            setQ("");
            setState("");
          }}
        />
      )}
      {!saved && (
        <div className="space-y-4">
          {filtered.map((p) => {
            const o = demo?.owned.find((o) => o.code === p.code);
            return (
              <div key={p.code} className="surface flex flex-wrap items-center gap-5 p-5">
                <div className="contour-bg grid size-20 place-items-center rounded-xl bg-overlay">
                  <ParcelSvg shape={p.shape} className="h-16 w-16" />
                </div>
                <div className="min-w-40 flex-1">
                  <span className="font-mono text-xs text-gold">{p.code}</span>
                  <h2 className="mt-1 text-xl">
                    {p.location}, {p.state}
                  </h2>
                  <p className="mt-1 text-xs text-low">
                    {p.size} sqm · {o?.stage || "Saved for later"}
                  </p>
                </div>
                <StatusChip status={p.status} />
                {o && <ProgressRing value={(STAGES.indexOf(o.stage) + 1) * 20} size={44} />}
                <div className="min-w-28 text-right num text-sm">
                  {naira(o?.paid || p.price)}
                  <p className="mt-1 text-xs text-low">{o ? "Amount paid" : "Plot price"}</p>
                </div>
                <Button variant="outline" asChild>
                  <Link href={o ? `/dashboard/plots/${p.code}` : `/dashboard/explore/${p.code}`}>
                    Open record <ArrowUpRight size={15} />
                  </Link>
                </Button>
              </div>
            );
          })}
          {!filtered.length && !((coCount || reservations.data?.total) && !saved) && (
            <div className="py-4">
              <EmptyState
                title={
                  list.length
                    ? "No plots match these filters."
                    : saved
                      ? "Save the plots you want to come back to."
                      : "You haven’t reserved any plots yet."
                }
                cta={
                  list.length ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setQ("");
                        setState("");
                        setStage("");
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : (
                    <Button asChild>
                      <Link href="/dashboard/explore">Explore plots</Link>
                    </Button>
                  )
                }
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
