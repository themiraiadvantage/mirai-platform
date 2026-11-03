"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Eye, MapPin, ArrowUpRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { naira } from "@/lib/data";
import { BeaconMap } from "@/components/mirai/SiteChecks";
import { useAdmin } from "./admin-store";
import { PageHead, Panel, Badge, SearchBox, Empty, LocalPhoto, FileView } from "./admin-ui";

export function AdminCatalogue() {
  const { data } = useAdmin();
  const [q, setQ] = useState("");
  const [state, setState] = useState("");
  const [availability, setAvailability] = useState("");
  const list = data.plots.filter(
    (p) =>
      p.publication === "Published" &&
      (!state || p.state === state) &&
      (!availability || p.availability === availability) &&
      (p.title + p.location + p.code).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <PageHead
        eyebrow="BUYER EXPERIENCE PREVIEW"
        title="Your published catalogue"
        description="See how your saved listings come together. This catalogue is separate from the live buyer website."
        action={
          <Button variant="outline" asChild>
            <Link href="/admin/plots">
              Manage listings <ArrowUpRight size={15} />
            </Link>
          </Button>
        }
      />
      <div className="admin-toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search published plots…" />
        <select
          aria-label="Catalogue state"
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          <option value="">All states</option>
          <option>Lagos</option>
          <option>Ogun</option>
        </select>
        <select
          aria-label="Catalogue availability"
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
        >
          <option value="">All availability</option>
          <option>Available</option>
          <option>Reserved</option>
          <option>Sold</option>
        </select>
        <span className="admin-record-count">{list.length} published plots</span>
      </div>
      <div className="admin-catalogue-grid">
        {list.map((p) => (
          <article key={p.code} className="admin-catalogue-card">
            <Link href={`/admin/plots/${p.code}/preview`} className="admin-catalogue-cover">
              <LocalPhoto id={p.photos[0]?.id} fallback={p.cover} alt={p.title} />
              <span>{p.code}</span>
              <div>
                <Badge>{p.availability}</Badge>
              </div>
            </Link>
            <div className="admin-panel-body">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin size={13} />
                {p.location}, {p.state} · {p.size} sqm
              </p>
              <h2 className="mt-3 text-lg font-semibold">{p.title}</h2>
              <p className="mt-3 text-2xl font-semibold">{naira(p.price)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {p.plans.map((plan) => (
                  <span key={plan} className="admin-plan-tag">
                    {plan === "Outright" ? plan : plan.replace("mo", " months")}
                  </span>
                ))}
              </div>
              <Button asChild variant="outline" className="mt-6 w-full">
                <Link href={`/admin/plots/${p.code}/preview`}>
                  View listing <ArrowUpRight size={14} />
                </Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!list.length && (
        <Panel>
          <Empty
            title="No published plots in this view"
            description="Publish a complete draft or adjust your filters."
          />
        </Panel>
      )}
    </>
  );
}

export default function AdminListingPreview({ code }: { code: string }) {
  const { data } = useAdmin();
  const plot = data.plots.find((p) => p.code === code);
  const [tab, setTab] = useState("Overview");
  const [docId, setDocId] = useState("");
  if (!plot)
    return (
      <Empty
        title="Listing not found"
        action={
          <Button asChild>
            <Link href="/admin/plots">Back to plots</Link>
          </Button>
        }
      />
    );
  const documents = data.documents.filter((d) => d.plot === code && d.visibility === "Listing");
  const costs = [
    ["Land price", plot.price],
    ["Legal fees", plot.legalFee],
    ["Survey fees", plot.surveyFee],
    ["Documentation fees", plot.documentationFee],
    ["Reservation / access", plot.reservationFee],
  ] as const;
  return (
    <>
      <Link href="/admin/catalogue" className="admin-back-link">
        <ArrowLeft size={15} />
        Catalogue preview
      </Link>
      <PageHead
        eyebrow={`SAVED LISTING PREVIEW · ${plot.code}`}
        title={plot.title || "Untitled plot"}
        description={`${plot.location}, ${plot.state} · ${plot.size} sqm`}
        action={
          <>
            <Badge>{plot.publication}</Badge>
            <Button variant="outline" asChild>
              <Link href={`/admin/plots/${code}`}>
                Edit listing <ArrowUpRight size={15} />
              </Link>
            </Button>
          </>
        }
      />
      <div className="admin-callout mb-6">
        <Eye size={18} />
        You are viewing the last saved listing. Buyer-only and staff-only documents are excluded.
        Checkout is not connected.
      </div>
      <div className="admin-tabs">
        {["Overview", "Map & GPS", "Documents", "Site assessment", "Costs & plans"].map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === "Overview" && (
        <div className="admin-listing-layout">
          <div>
            <div className="admin-listing-photo">
              <LocalPhoto id={plot.photos[0]?.id} fallback={plot.cover} alt={plot.title} />
            </div>
            <div className="admin-listing-thumbnails">
              {plot.photos.slice(1).map((p) => (
                <LocalPhoto key={p.id} id={p.id} alt={p.name} />
              ))}
            </div>
            <Panel title="About this plot" className="mt-6">
              <div className="admin-panel-body">
                <p className="whitespace-pre-wrap text-sm leading-8 text-muted-foreground">
                  {plot.description || "Description not added."}
                </p>
                <div className="admin-detail-grid mt-6">
                  <div>
                    <small>Size</small>
                    <strong>{plot.size} sqm</strong>
                  </div>
                  <div>
                    <small>Local government area</small>
                    <strong>{plot.lga || "Not added"}</strong>
                  </div>
                  <div>
                    <small>Document verification</small>
                    <strong>{plot.status.replaceAll("_", " ")}</strong>
                  </div>
                  <div>
                    <small>Site assessment</small>
                    <strong>{plot.siteStatus}</strong>
                  </div>
                </div>
              </div>
            </Panel>
          </div>
          <Panel title="Purchase overview">
            <div className="admin-panel-body">
              <Badge>{plot.availability}</Badge>
              <p className="mt-5 text-3xl font-semibold">{naira(plot.price)}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Land price · Additional costs listed separately
              </p>
              <div className="mt-6 space-y-4">
                {costs.slice(1).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <strong>{naira(value)}</strong>
                  </div>
                ))}
              </div>
              <div className="admin-price-total mt-6">
                <span>Outright total</span>
                <strong>{naira(costs.reduce((sum, [, value]) => sum + value, 0))}</strong>
              </div>
              <Button className="mt-6 w-full" disabled>
                Checkout preview only
              </Button>
              <p className="mt-4 text-xs leading-6 text-muted-foreground">
                No reservation or charge is created from this listing preview.
              </p>
            </div>
          </Panel>
        </div>
      )}
      {tab === "Map & GPS" && (
        <Panel>
          <div className="admin-panel-body">
            {plot.beacons.length >= 3 ? (
              <BeaconMap plot={plot} />
            ) : (
              <Empty
                title="Boundary not added"
                description="Add at least three survey beacons in the plot editor."
              />
            )}
          </div>
        </Panel>
      )}
      {tab === "Documents" && (
        <Panel title="Listing documents">
          <div className="admin-panel-body space-y-3">
            {documents.map((d) => (
              <button
                key={d.id}
                onClick={() => setDocId(d.id)}
                className="admin-linked-record w-full text-left"
              >
                <FileText size={19} />
                <div>
                  <strong>{d.name}</strong>
                  <small>{d.reviewer || "Reviewer not assigned"}</small>
                </div>
                <Badge>{d.status}</Badge>
                <ArrowUpRight size={15} />
              </button>
            ))}
            {!documents.length && (
              <Empty
                title="No listing documents added"
                description="Private buyer files do not appear in this view."
              />
            )}
          </div>
        </Panel>
      )}
      {tab === "Site assessment" && (
        <>
          <div className="admin-callout mb-5">
            {plot.siteStatus} · Reviewer: {plot.siteReviewer || "Not assigned"} · Method:{" "}
            {plot.siteMethod || "Not recorded"}. Sample findings are not professional sign-off.
          </div>
          <div className="admin-site-grid">
            {plot.checks.map((c) => (
              <Panel key={c.key} title={c.label} description={c.meaning}>
                <div className="admin-panel-body">
                  <Badge>
                    {c.result === "nodata"
                      ? "Not enough data"
                      : c.result === "further"
                        ? "Further review recommended"
                        : "No material issue found"}
                  </Badge>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Source: {c.source || "Not recorded"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Date: {c.date || "Not recorded"} · Confidence: {c.reliability}/3
                  </p>
                  <p className="mt-4 text-xs leading-6 text-muted-foreground">
                    Next action:{" "}
                    {plot.siteNextAction ||
                      (c.result === "ok"
                        ? "Confirm the currency and scope of the evidence."
                        : "Collect evidence and arrange specialist review where needed.")}
                  </p>
                </div>
              </Panel>
            ))}
          </div>
        </>
      )}
      {tab === "Costs & plans" && (
        <Panel title="Full cost breakdown">
          <div className="admin-panel-body">
            <div className="space-y-4">
              {costs.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 border-b border-border pb-4 text-sm"
                >
                  <span>{label}</span>
                  <strong>{naira(value)}</strong>
                </div>
              ))}
            </div>
            <div className="admin-mini-stats mt-6">
              {plot.plans.map((plan) => {
                const total = plot.price * (plan === "6mo" ? 1.05 : 1);
                const months = plan === "Outright" ? 1 : plan === "3mo" ? 3 : 6;
                return (
                  <div key={plan}>
                    <small>{plan === "Outright" ? plan : `${months} months`}</small>
                    <strong>{naira(total / months)}</strong>
                    <small>{plan === "Outright" ? "Once" : "Per month, land only"}</small>
                  </div>
                );
              })}
            </div>
            <p className="mt-5 text-xs leading-6 text-muted-foreground">
              Additional fees are separate. The six-month sample plan includes a 5% land markup.
              Access lasts {plot.accessMonths} months. Commercial and refund terms need final
              confirmation.
            </p>
          </div>
        </Panel>
      )}
      <FileView
        document={documents.find((d) => d.id === docId) || null}
        onClose={() => setDocId("")}
      />
    </>
  );
}
