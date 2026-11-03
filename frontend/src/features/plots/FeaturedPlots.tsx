"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PropertyImage } from "@/components/mirai/PropertyImage";
import { propertyNaira as naira } from "@/lib/property-api";
import { usePropertyResource, type LivePlot, type Page } from "@/lib/property-api";
export function FeaturedPlots() {
  const resource = usePropertyResource<Page<LivePlot>>("/plots", false);
  return (
    <>
      {resource.loading && (
        <div role="status" className="mt-8 h-48 animate-pulse rounded-2xl bg-slate-100" />
      )}
      {resource.error && (
        <p className="mt-8">The catalogue is temporarily unavailable. Please try again shortly.</p>
      )}
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {resource.data?.items
          .filter((p) => p.availability === "Available")
          .slice(0, 3)
          .map((p) => {
            const photo = p.assets.find((a) => a.kind === "PHOTO");
            return (
              <article key={p.id} className="surface overflow-hidden">
                {photo && (
                  <PropertyImage
                    id={photo.id}
                    alt={p.title}
                    className="aspect-[16/10] w-full object-cover"
                  />
                )}
                <div className="p-6">
                  <p className="font-mono text-sm text-amber-800">{p.code}</p>
                  <h3 className="mt-3 text-xl">{p.title}</h3>
                  <p className="mt-2 text-sm text-slate-700">
                    {p.location}, {p.state} · {p.size} sqm
                  </p>
                  <p className="mt-4 text-xl font-semibold">{naira(Number(p.price))}</p>
                  <Button className="mt-5 w-full" variant="outline" asChild>
                    <Link href={`/plots/${p.code}`}>View plot</Link>
                  </Button>
                </div>
              </article>
            );
          })}
      </div>
      {!resource.loading && !resource.error && !resource.data?.items.length && (
        <p className="mt-5 text-slate-700">New listings will appear here when they are ready.</p>
      )}
    </>
  );
}
