"use client";
import Link from "next/link";
import { useState } from "react";
import { PublicLayout } from "@/components/mirai/SiteChrome";
import { Button } from "@/components/ui/button";
import { usePropertySearch, propertyNaira as naira } from "@/lib/property-api";
import {
  assetUrl,
  mapPlot,
  openPrivateAsset,
  usePropertyResource,
  type LivePlot,
  type Page,
} from "@/lib/property-api";
import { MapView } from "@/components/mirai/MapView";
import { PropertyImage } from "@/components/mirai/PropertyImage";
import { toast } from "sonner";
import { ReservationCheckout } from "./ReservationCheckout";
import { SavePlotButton } from "@/components/mirai/SavedPlots";

export function LiveCatalogue({ workspace = false }: { workspace?: boolean }) {
  const [q, setQ] = useState("");
  const search = usePropertySearch(q);
  const [cursor, setCursor] = useState("");
  const resource = usePropertyResource<Page<LivePlot>>(
    `/plots?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(cursor ? { cursor } : {}) })}`,
    false,
  );
  const base = workspace ? "/dashboard/explore" : "/plots";
  const content = (
    <section className={`mx-auto max-w-7xl ${workspace ? "" : "px-5 py-14"}`}>
      <p className="eyebrow">Find your next chapter</p>
      <h1 className="page-title">Explore plots</h1>
      <p className="page-subtitle">
        View available land, supporting documents and ownership options.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <input
          className="min-w-64 flex-1 rounded-xl border bg-white p-3"
          aria-label="Search plots"
          placeholder="Search plot code, location or title…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setCursor("");
          }}
        />
        <Button variant="outline" onClick={resource.refresh}>
          Refresh
        </Button>
      </div>
      {resource.error && (
        <p role="alert" className="surface mt-6 p-6">
          {resource.error}
        </p>
      )}
      {resource.loading && (
        <p className="mt-6" role="status">
          Loading published plots…
        </p>
      )}
      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {resource.data?.items.map((p) => {
          const photo = p.assets.find((a) => a.kind === "PHOTO");
          return (
            <article key={p.id} className="surface relative overflow-hidden">
              <SavePlotButton
                plotId={p.id}
                code={p.code}
                iconOnly
                className="absolute right-3 top-3 z-10 rounded-full bg-white shadow-sm"
              />
              {photo && (
                <Link href={`${base}/${p.code}`}>
                  <img
                    src={assetUrl(photo.id)}
                    alt={p.title}
                    className="aspect-[16/10] w-full object-cover"
                    loading="lazy"
                  />
                </Link>
              )}
              <div className="p-6">
                <div className="flex flex-wrap justify-between gap-3 text-sm">
                  <span className="font-mono text-amber-800">{p.code}</span>
                  <span>{p.availability}</span>
                </div>
                <h2 className="mt-3 text-2xl">{p.title}</h2>
                <p className="mt-2 text-slate-700">
                  {p.location}, {p.state} · {p.size} sqm
                </p>
                <p className="mt-4 text-2xl font-semibold">{naira(Number(p.price))}</p>
                <p className="mt-2 text-sm text-slate-700">
                  Verification: {p.verification.replaceAll("_", " ")}
                </p>
                {p.coEnabled &&
                  p.size >= 500 &&
                  p.verification === "verified" &&
                  p.availability === "Available" && (
                    <p className="mt-2 text-sm font-medium text-amber-800">
                      Co-ownership enabled · 50% each
                    </p>
                  )}
                <Button className="mt-6 w-full" variant="outline" asChild>
                  <Link href={`${base}/${p.code}`}>View plot details</Link>
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {!resource.loading && !resource.error && !resource.data?.items.length && (
        <div className="surface mt-8 p-9">
          <h2 className="text-2xl">
            {q ? "No plots match your search" : "New plots are on the way"}
          </h2>
          <p className="mt-3 text-slate-700">
            {q
              ? "Try another plot code or location."
              : "Published listings will appear here when they are ready."}
          </p>
        </div>
      )}
      <div className="mt-7 flex gap-3">
        {cursor && (
          <Button variant="outline" onClick={() => setCursor("")}>
            First page
          </Button>
        )}
        {resource.data?.nextCursor && (
          <Button variant="outline" onClick={() => setCursor(resource.data!.nextCursor!)}>
            More plots
          </Button>
        )}
      </div>
    </section>
  );
  return workspace ? content : <PublicLayout>{content}</PublicLayout>;
}
export function LivePlotDetail({
  code,
  workspace = false,
  admin = false,
}: {
  code: string;
  workspace?: boolean;
  admin?: boolean;
}) {
  const resource = usePropertyResource<LivePlot>(
    `${admin ? "/admin" : ""}/plots/${encodeURIComponent(code)}`,
    admin,
  );
  const p = resource.data;
  const [photoId, setPhotoId] = useState("");
  const base = admin ? "/admin/plots" : workspace ? "/dashboard/explore" : "/plots";
  const photo =
    p?.assets.find((a) => a.id === photoId && a.kind === "PHOTO") ||
    p?.assets.find((a) => a.kind === "PHOTO");
  const content = (
    <section className={`mx-auto max-w-6xl ${workspace || admin ? "" : "px-5 py-14"}`}>
      <Link className="text-sm font-medium" href={base}>
        ← Back to plots
      </Link>
      {resource.error && (
        <div role="alert" className="surface mt-6 p-6">
          {resource.error}
          <Button className="ml-4" variant="outline" onClick={resource.refresh}>
            Try again
          </Button>
        </div>
      )}
      {resource.loading && (
        <p role="status" className="mt-6">
          Loading plot details…
        </p>
      )}
      {p && (
        <>
          <p className="eyebrow mt-7">
            {p.code} · {p.verification.replaceAll("_", " ")}
          </p>
          <h1 className="page-title">{p.title}</h1>
          <p className="page-subtitle">
            {p.location}, {p.lga}, {p.state} · {p.size} sqm
          </p>
          <div className="mt-8 grid items-start gap-7 lg:grid-cols-[1.4fr_1fr]">
            <div>
              {photo && (
                <PropertyImage
                  id={photo.id}
                  admin={admin}
                  alt={p.title}
                  className="aspect-[16/10] w-full rounded-2xl object-cover"
                />
              )}
              <div className="mt-3 flex gap-3 overflow-auto">
                {p.assets
                  .filter((a) => a.kind === "PHOTO")
                  .map((a) => (
                    <button
                      className="shrink-0 rounded-lg border px-3 py-2 text-sm"
                      key={a.id}
                      onClick={() => setPhotoId(a.id)}
                    >
                      {a.name}
                    </button>
                  ))}
              </div>
              <article className="surface mt-6 p-6">
                <h2 className="text-2xl">About this plot</h2>
                <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-700">{p.description}</p>
                <p className="mt-5 text-sm">Site assessment: {p.details.siteStatus}</p>
                <p className="mt-2 text-sm">
                  Coordinates: {p.details.latitude}, {p.details.longitude}
                </p>
              </article>
              <article className="surface mt-6 overflow-hidden p-6">
                <h2 className="text-2xl">Map and boundaries</h2>
                <div className="mt-5 h-80 overflow-hidden rounded-xl border">
                  <MapView plots={[mapPlot(p)]} focus={p.code} />
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  Boundary drawn from the listing’s surveyed beacon coordinates.
                </p>
              </article>
              {!!p.details.checks?.length && (
                <article className="surface mt-6 p-6">
                  <h2 className="text-2xl">Site findings</h2>
                  <div className="mt-5 space-y-5">
                    {p.details.checks.map((c) => (
                      <section key={c.key} className="rounded-xl border p-4">
                        <h3 className="font-semibold">{c.label}</h3>
                        <p className="mt-2 text-sm font-medium">
                          {c.result === "ok"
                            ? "No material issue found in available checks"
                            : c.result === "further"
                              ? "Further checking needed"
                              : "Not enough evidence"}
                        </p>
                        <p className="mt-3 text-sm text-slate-700">
                          Source: {c.source || "Not recorded"}
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          {c.reviewer || "Reviewer not recorded"} · {c.date || "Date not recorded"}
                        </p>
                        {c.notes && (
                          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                            {c.notes}
                          </p>
                        )}
                      </section>
                    ))}
                  </div>
                </article>
              )}
              <article id="listing-documents" className="surface mt-6 scroll-mt-24 p-6">
                <h2 className="text-2xl">Listing documents</h2>
                <p className="mt-3 text-slate-700">{p.details.docSummary}</p>
                <div className="mt-4 space-y-3">
                  {p.assets
                    .filter((a) => a.kind === "LISTING_DOCUMENT")
                    .map((a) =>
                      admin ? (
                        <button
                          key={a.id}
                          className="block w-full rounded-xl border p-4 text-left font-medium"
                          onClick={() =>
                            void openPrivateAsset(a.id, true).catch((e) => toast.error(e.message))
                          }
                        >
                          {a.name} ↗
                        </button>
                      ) : (
                        <a
                          key={a.id}
                          className="block rounded-xl border p-4 font-medium"
                          href={assetUrl(a.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {a.name} ↗
                        </a>
                      ),
                    )}
                </div>
              </article>
            </div>
            <aside className="surface p-7">
              <p className="text-sm text-slate-600">Land price</p>
              <p className="mt-2 text-3xl font-semibold">{naira(Number(p.price))}</p>
              <p className="mt-3 font-medium">{p.availability}</p>
              <dl className="mt-5 divide-y">
                {[
                  ["Legal fee", p.legalFee],
                  ["Survey fee", p.surveyFee],
                  ["Documentation", p.documentationFee],
                  ["Reservation / access fee", p.reservationFee],
                ].map(([label, amount]) => (
                  <div key={String(label)} className="flex justify-between gap-4 py-3">
                    <dt>{label}</dt>
                    <dd>{naira(Number(amount))}</dd>
                  </div>
                ))}
              </dl>
              {!admin && <SavePlotButton plotId={p.id} code={p.code} className="mt-5 w-full" />}
              {!admin && <ReservationCheckout plot={p} />}
              {p.coEnabled &&
                p.size >= 500 &&
                p.verification === "verified" &&
                p.availability === "Available" && (
                  <div className="mt-6 rounded-xl bg-amber-50 p-5">
                    <h2 className="text-lg font-semibold">Buy with a partner</h2>
                    <p className="mt-2 text-sm leading-6">
                      Equal shares, with a land contribution of {naira(Number(p.price) / 2)} each
                      plus half the listed legal, survey and documentation fees.
                    </p>
                    <Button className="mt-4 w-full" asChild>
                      <Link
                        href={`${workspace ? "/dashboard/co-own/start" : "/co-own"}?plot=${p.code}`}
                      >
                        Explore co-ownership
                      </Link>
                    </Button>
                  </div>
                )}
              {admin && (
                <Button className="mt-5 w-full" asChild>
                  <Link href={`/admin/plots/${p.code}`}>Edit listing</Link>
                </Button>
              )}
              <p className="mt-5 text-sm leading-6 text-slate-600">
                Review the listing documents and contact MIRAI with any questions before proceeding.
              </p>
            </aside>
          </div>
        </>
      )}
    </section>
  );
  return workspace || admin ? content : <PublicLayout>{content}</PublicLayout>;
}
