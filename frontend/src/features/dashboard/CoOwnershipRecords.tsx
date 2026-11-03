"use client";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { propertyNaira as naira } from "@/lib/property-api";
import { matchesLibraryFilters, type LibraryFilters } from "@/lib/library-filters";
import {
  coStatus,
  openPrivateAsset,
  paidAmount,
  usePropertyResource,
  type CoRequest,
  type Page,
} from "@/lib/property-api";
export function CoOwnershipRecords({
  documents = false,
  compact = false,
  libraryFilters,
}: {
  documents?: boolean;
  compact?: boolean;
  libraryFilters?: LibraryFilters;
}) {
  const resource = usePropertyResource<Page<CoRequest>>(
    documents ? "/co-ownership?status=ALLOCATED" : "/co-ownership",
  );
  const records =
    resource.data?.items.filter((r) =>
      documents ? r.status === "ALLOCATED" : ["ACTIVE", "ALLOCATED", "PROPOSED"].includes(r.status),
    ) || [];
  if (resource.loading)
    return (
      <div className="surface mt-6 p-5" role="status">
        Loading co-ownership records…
      </div>
    );
  if (resource.error)
    return (
      <div className="surface mt-6 p-5">
        <p role="alert">Could not load co-ownership records. {resource.error}</p>
        <Button className="mt-3" variant="outline" onClick={resource.refresh}>
          Try again
        </Button>
      </div>
    );
  if (!records.length) return null;
  const visible = records.filter((r) =>
    matchesLibraryFilters(
      r.plot,
      r.status === "ALLOCATED" ? "Complete" : r.status === "ACTIVE" ? "Payment" : "Reservation",
      libraryFilters,
    ),
  );
  return (
    <section className="surface mt-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl">
          {documents ? "Co-ownership allocation documents" : "Your co-ownership partnerships"}
        </h2>
        <Link className="text-sm font-semibold" href="/dashboard/co-own">
          View all co-ownership →
        </Link>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {!visible.length && (
          <p className="text-sm text-slate-700 sm:col-span-2">
            No co-ownership plots match these filters.
          </p>
        )}
        {visible.slice(0, compact ? 2 : 30).map((r) => (
          <article key={r.id} className="rounded-xl border p-5">
            <p className="text-sm font-semibold text-amber-800">{r.plot.code}</p>
            <h3 className="mt-2 text-lg font-semibold">{r.plot.title}</h3>
            <p className="mt-2 text-sm text-slate-700">50% share · {coStatus[r.status]}</p>
            {!documents && (
              <p className="mt-2 text-sm text-slate-700">
                {naira(paidAmount(r))} confirmed of {naira(r.offer.total)}
              </p>
            )}
            {documents ? (
              r.match?.allocations.map((a) => (
                <div key={a.id} className="mt-4">
                  <p className="text-sm">{a.portion}</p>
                  <Button
                    className="mt-3"
                    variant="outline"
                    onClick={() =>
                      void openPrivateAsset(a.documentId).catch((e) => toast.error(e.message))
                    }
                  >
                    Download allocation document
                  </Button>
                </div>
              ))
            ) : (
              <Button className="mt-4" variant="outline" asChild>
                <Link href="/dashboard/co-own">Open partnership</Link>
              </Button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
