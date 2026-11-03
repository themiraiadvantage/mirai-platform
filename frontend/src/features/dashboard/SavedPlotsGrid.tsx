"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bookmark, MapPin, ArrowUpRight } from "lucide-react";
import { SavePlotButton, useSavedPlots } from "@/components/mirai/SavedPlots";
import { Button } from "@/components/ui/button";
import {
  assetUrl,
  propertyNaira as naira,
  usePropertyResource,
  usePropertySearch,
} from "@/lib/property-api";
type SavedPage = {
  items: {
    id: string;
    plotId: string;
    savedAt: string;
    plot: null | {
      id: string;
      code: string;
      title: string;
      location: string;
      state: string;
      size: number;
      price: string;
      availability: string;
      assets: { id: string }[];
    };
  }[];
  total: number;
  nextCursor: string | null;
};
export function SavedPlotsGrid({
  query,
  state,
  clearFilters,
}: {
  query: string;
  state: string;
  clearFilters: () => void;
}) {
  const saved = useSavedPlots();
  const q = usePropertySearch(query);
  const [page, setPage] = useState({ cursor: "", key: "" });
  const key = `${q}:${state}`;
  const cursor = page.key === key ? page.cursor : "";
  const records = usePropertyResource<SavedPage>(
    `/saved-plots?${new URLSearchParams({ ...(q ? { q } : {}), ...(state ? { state } : {}), ...(cursor ? { cursor } : {}) })}`,
  );
  const { refresh } = records;
  useEffect(() => {
    refresh();
  }, [saved.revision, refresh]);
  return (
    <section aria-label="Saved plots">
      <div className="mb-6 flex items-start gap-3 rounded-xl border bg-slate-50 p-4">
        <Bookmark size={20} className="mt-0.5 shrink-0 text-amber-800" />
        <p className="text-sm leading-6 text-slate-700">
          Your shortlist, ready when you are. Saving a plot is free and does not reserve it.
          Availability and prices can change.
        </p>
      </div>
      {records.error && (
        <div role="alert" className="surface p-6">
          <p>{records.error}</p>
          <Button className="mt-4" variant="outline" onClick={refresh}>
            Try again
          </Button>
        </div>
      )}
      {records.loading && !records.data && (
        <div role="status" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="surface h-80 animate-pulse bg-slate-100" />
          ))}
          <span className="sr-only">Loading saved plots…</span>
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {records.data?.items.map((row) => {
          const p = row.plot;
          if (!p)
            return (
              <article key={row.id} className="surface p-6">
                <h2 className="text-xl">Listing no longer available</h2>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  This listing has been withdrawn. You can remove it from your shortlist.
                </p>
                <SavePlotButton className="mt-5" plotId={row.plotId} code="" />
              </article>
            );
          const href = `/dashboard/explore/${p.code}`;
          return (
            <article key={row.id} className="surface overflow-hidden">
              <div className="relative aspect-[16/10] bg-slate-100">
                <Link href={href} className="block h-full">
                  {p.assets[0] ? (
                    <img
                      src={assetUrl(p.assets[0].id)}
                      alt={p.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="grid h-full place-items-center">
                      <MapPin size={36} className="text-slate-400" />
                    </div>
                  )}
                </Link>
                <SavePlotButton
                  plotId={p.id}
                  code={p.code}
                  iconOnly
                  className="absolute right-3 top-3 rounded-full bg-white shadow-sm"
                />
                <span
                  className={`absolute bottom-3 left-3 rounded-full px-3 py-1 text-xs font-semibold ${p.availability === "Available" ? "bg-white text-emerald-800" : "bg-slate-900 text-white"}`}
                >
                  {p.availability}
                </span>
              </div>
              <div className="p-5">
                <p className="font-mono text-xs text-amber-800">{p.code}</p>
                <h2 className="mt-2 text-xl font-semibold">
                  <Link href={href}>{p.title}</Link>
                </h2>
                <p className="mt-2 text-sm text-slate-700">
                  {p.location}, {p.state} · {p.size} sqm
                </p>
                <p className="mt-5 text-2xl font-semibold tracking-tight">
                  {naira(Number(p.price))}
                </p>
                <Button className="mt-5 w-full" variant="outline" asChild>
                  <Link href={href}>
                    View plot
                    <ArrowUpRight size={15} />
                  </Link>
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {!records.loading && !records.error && !records.data?.items.length && (
        <div className="surface p-9 text-center">
          <Bookmark size={30} className="mx-auto text-amber-800" />
          <h2 className="mt-4 text-2xl">
            {q || state
              ? "No saved plots match these filters."
              : "Save the plots you want to come back to."}
          </h2>
          <p className="mt-3 text-sm text-slate-700">
            {q || state
              ? "Try another location or clear your filters."
              : "Tap the bookmark on a plot to add it to your shortlist."}
          </p>
          {q || state ? (
            <Button className="mt-5" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : (
            <Button className="mt-5" asChild>
              <Link href="/dashboard/explore">Explore plots</Link>
            </Button>
          )}
        </div>
      )}
      <div className="mt-6 flex gap-3">
        {cursor && (
          <Button variant="outline" onClick={() => setPage({ key, cursor: "" })}>
            First page
          </Button>
        )}
        {records.data?.nextCursor && (
          <Button
            variant="outline"
            onClick={() => setPage({ key, cursor: records.data!.nextCursor! })}
          >
            More saved plots
          </Button>
        )}
      </div>
    </section>
  );
}
