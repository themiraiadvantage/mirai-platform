"use client";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { ArrowLeft, Lock, Eye } from "lucide-react";
import { PublicLayout } from "@/components/mirai/SiteChrome";
import { Chip, Fact, ParcelSvg, StatusChip, toneChip } from "@/components/mirai/primitives";
import { BeaconMap, SiteChecks } from "@/components/mirai/SiteChecks";
import { ReserveDrawer } from "@/components/mirai/ReserveDrawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RESERVATION_FEE, costBreakdown, getPlot, naira, planSchedule } from "@/lib/data";
import { cn } from "@/lib/utils";
import { LAND_PHOTOS } from "@/lib/photos";
import { MapView } from "@/components/mirai/MapView";

function Gallery({ plot }: { plot: ReturnType<typeof getPlot> & {} }) {
  const [i, setI] = useState(0);
  const slides = [
    "map",
    ...LAND_PHOTOS.map((_, k) => (plot.photo + k) % LAND_PHOTOS.length),
  ] as const;
  const cur = slides[i];
  return (
    <div className="space-y-2">
      <div className="surface relative aspect-[16/9] overflow-hidden">
        {cur === "map" ? (
          <MapView plots={[plot]} focus={plot.code} />
        ) : (
          <img
            src={LAND_PHOTOS[cur as number]}
            alt={`Site photo, ${plot.location}`}
            width={1280}
            height={800}
            className="h-full w-full object-cover"
          />
        )}
        <span className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-md bg-background/85 px-2 py-1 text-xs text-muted-foreground">
          {cur === "map"
            ? `Satellite view · ${plot.centre[0].toFixed(4)}°N, ${plot.centre[1].toFixed(4)}°E`
            : "Illustrative landscape · Not a site inspection photo"}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {slides.map((s, k) => (
          <button
            key={k}
            onClick={() => setI(k)}
            aria-label={s === "map" ? "Satellite view" : `Photo ${k}`}
            className={cn(
              "aspect-[16/10] overflow-hidden rounded-lg border",
              k === i ? "border-gold" : "border-border",
            )}
          >
            {s === "map" ? (
              <div className="flex h-full items-center justify-center bg-overlay">
                <ParcelSvg shape={plot.shape} beacons={false} className="h-3/4" />
              </div>
            ) : (
              <img
                src={LAND_PHOTOS[s as number]}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

const docTone = { available: toneChip.success, review: toneChip.info, pending: toneChip.warning };
const docLabel = { available: "Available", review: "Under review", pending: "Pending" };

export default function PlotDetail({
  plot,
  workspace = false,
}: {
  plot: NonNullable<ReturnType<typeof getPlot>>;
  workspace?: boolean;
}) {
  const Layout = workspace ? Fragment : PublicLayout;
  const [plan, setPlan] = useState<"Outright" | "3mo" | "6mo">(plot.plans[0] ?? "Outright");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("overview");
  useEffect(() => {
    const requestedPlan = new URLSearchParams(window.location.search).get("plan");
    const selected = plot.plans.find((p) => p === requestedPlan);
    if (selected) setPlan(selected);
    const requestedTab = window.location.hash.slice(1);
    if (["overview", "map", "docs", "site", "plans"].includes(requestedTab)) setTab(requestedTab);
  }, [plot.code, plot.plans]);
  const s = planSchedule(plot.price, plan);
  const costs = [
    ...costBreakdown(plot.price),
    ...(s.total > plot.price
      ? [
          {
            label: "6-month plan cost",
            amount: s.total - plot.price,
            note: "5% of the land price, shown separately",
          },
        ]
      : []),
    {
      label: "Reservation + access fee",
      amount: RESERVATION_FEE,
      note: "12 months of location and document access",
    },
  ];
  const total = costs.reduce((a, c) => a + c.amount, 0);
  const verified = plot.status === "verified";

  return (
    <Layout>
      <div className={workspace ? "mx-auto max-w-7xl" : "mx-auto max-w-7xl px-5 py-10"}>
        <Link
          href={workspace ? "/dashboard/explore" : "/plots"}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All plots
        </Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-gold">{plot.code}</span>
              <StatusChip status={plot.status} />
            </div>
            <h1 className="mt-2 text-4xl md:text-6xl">
              {plot.location}, {plot.state}
            </h1>
          </div>
          <div className="text-right">
            <div className="num font-display text-4xl">{naira(plot.price)}</div>
            <div className="text-sm text-low num">
              {plot.size} sqm · {naira(plot.price / plot.size)}/sqm
            </div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mt-10">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-[12px] border border-border bg-card p-1">
            {[
              ["overview", "Overview"],
              ["map", "Map & GPS"],
              ["docs", "Documents"],
              ["site", "Site assessment"],
              ["plans", "Payment plans"],
            ].map(([v, l]) => (
              <TabsTrigger
                key={v}
                value={v!}
                className="rounded-lg px-4 py-2 data-[state=active]:bg-overlay"
              >
                {l}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="mt-8 animate-rise">
            <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
              <div className="space-y-6">
                <Gallery plot={plot} />
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <Fact label="Size" value={`${plot.size} sqm`} />
                  <Fact label="LGA" value={plot.lga} />
                  <Fact
                    label="Survey plan"
                    value="On file"
                    confirmed={plot.docs[0]?.status === "available"}
                  />
                  <Fact
                    label="Title"
                    value={verified ? "Verified" : "Under review"}
                    confirmed={verified}
                  />
                  <Fact
                    label="Site status"
                    value={plot.siteStatus}
                    confirmed={plot.siteStatus === "Site visit complete"}
                  />
                  <Fact
                    label="Road access"
                    value={
                      plot.siteStatus === "Not yet checked"
                        ? "Not enough data"
                        : "Sample access finding"
                    }
                    confirmed={plot.siteStatus === "Site visit complete"}
                  />
                </div>
              </div>
              <div className="surface h-fit space-y-5 p-6 lg:sticky lg:top-24">
                <div>
                  <div className="text-sm text-muted-foreground">Payment plan</div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {plot.plans.map((p) => (
                      <button
                        key={p}
                        onClick={() => setPlan(p)}
                        className={cn(
                          "rounded-[10px] border py-2 text-sm",
                          plan === p
                            ? "border-primary-bright bg-primary/20"
                            : "border-border text-muted-foreground",
                        )}
                      >
                        {p === "Outright" ? "Outright" : p.replace("mo", " months")}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 num text-2xl font-display">
                    {naira(s.monthly)}
                    <span className="text-sm text-low">
                      {" "}
                      {s.months > 1 ? `/ month × ${s.months}` : "once"}
                    </span>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {costs.map((c) => (
                      <tr key={c.label} className="border-t border-border">
                        <td className="py-2">
                          <div>{c.label}</div>
                          <div className="text-xs text-low">{c.note}</div>
                        </td>
                        <td className="py-2 text-right num">{naira(c.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-border font-medium">
                      <td className="py-3">Total cost of ownership</td>
                      <td className="py-3 text-right num text-gold">{naira(total)}</td>
                    </tr>
                  </tbody>
                </table>
                <Button size="lg" className="w-full" onClick={() => setOpen(true)}>
                  Reserve this plot: {naira(RESERVATION_FEE)}
                </Button>
                <p className="text-xs text-low">
                  Every cost above is shown before any payment. MIRAI is a technology platform, not
                  an estate agency.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="map" className="mt-8 animate-rise">
            <BeaconMap plot={plot} />
          </TabsContent>

          <TabsContent value="docs" className="mt-8 animate-rise">
            <div className="surface overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-low">
                  <tr>
                    {["Document", "Status", "Reviewed", "Reviewer", ""].map((h) => (
                      <th key={h} className="p-4 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plot.docs.map((d) => (
                    <tr key={d.name} className="border-t border-border even:bg-overlay/40">
                      <td className="p-4">{d.name}</td>
                      <td className="p-4">
                        <Chip className={docTone[d.status]}>{docLabel[d.status]}</Chip>
                      </td>
                      <td className="p-4 num text-muted-foreground">{d.reviewed ?? "Not set"}</td>
                      <td className="p-4 text-muted-foreground">{d.reviewer}</td>
                      <td className="p-4 text-right">
                        {d.status === "available" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-low">
                            <Lock className="h-3.5 w-3.5" />
                            Reserve to view
                          </span>
                        ) : (
                          <Eye className="ml-auto h-4 w-4 text-border" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Reserve to view full documents. Summaries are always public.
            </p>
          </TabsContent>

          <TabsContent value="site" className="mt-8 animate-rise">
            <SiteChecks plot={plot} />
          </TabsContent>

          <TabsContent value="plans" className="mt-8 animate-rise">
            <div className="grid gap-5 md:grid-cols-3">
              {plot.plans.map((p) => {
                const ps = planSchedule(plot.price, p);
                return (
                  <div key={p} className="surface p-6">
                    <h3 className="text-xl">
                      {p === "Outright" ? "Outright" : `${ps.months} months`}
                    </h3>
                    <div className="mt-2 num font-display text-3xl">{naira(ps.total)}</div>
                    {p === "6mo" && (
                      <div className="text-xs text-warning">
                        Includes 5% plan cost, shown upfront
                      </div>
                    )}
                    <ul className="mt-4 space-y-1.5 text-sm">
                      {Array.from({ length: ps.months }).map((_, i) => (
                        <li key={i} className="flex justify-between text-muted-foreground">
                          <span>Month {i + 1}</span>
                          <span className="num">{naira(ps.monthly)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div className="surface p-6">
                <h4 className="text-lg">Late or missed payments</h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  We'll remind you 7 and 2 days before each due date. If you miss one, we contact
                  you to agree a new date. No hidden penalty fees are added.
                </p>
              </div>
              <div className="surface p-6">
                <h4 className="text-lg">Refunds & cancellation</h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  Instalments are refundable minus documented legal and survey costs, itemised in
                  writing.{" "}
                  <Link
                    href={workspace ? "/dashboard/guide#fees" : "/fees"}
                    className="text-primary-bright"
                  >
                    Read full policy
                  </Link>
                  .
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <ReserveDrawer plot={plot} plan={plan} open={open} onOpenChange={setOpen} />
    </Layout>
  );
}
