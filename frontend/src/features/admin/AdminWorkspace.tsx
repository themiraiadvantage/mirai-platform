"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Plus,
  ArrowUpRight,
  ArrowRight,
  Map,
  Wallet,
  CalendarClock,
  FileCheck2,
  FileText,
  CheckCircle2,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { naira, nairaShort } from "@/lib/data";
import { useAdmin, dateLabel } from "./admin-store";
import { PageHead, Panel, Badge, SearchBox, Empty, LocalPhoto, DocumentManager } from "./admin-ui";
import { AdminBuyers, AdminReservations, AdminPayments, AdminMatches } from "./AdminOperations";
import { AdminAnnouncements, AdminAudit, AdminSettings, AdminChecks } from "./AdminManagement";
import { AdminCatalogue } from "./AdminPreview";
import { AdminStaffAccess } from "./AdminStaffAccess";
import { useAdminAccess } from "./admin-auth";
import { ACCESS_SECTIONS } from "./staff-access";
import { LiveAdminPlots } from "./LiveAdminPlots";
import { LiveAdminCoOwnership } from "./LiveAdminCoOwnership";
import { AdminRecentActivity } from "./AdminRecentActivity";
import type { ReservationPage } from "@/lib/reservation-api";
import { LiveAdminReservations } from "./LiveAdminReservations";
import { LiveAdminDocuments } from "./LiveAdminDocuments";
import { LiveAdminBuyers } from "./LiveAdminBuyers";
import type { DocumentPage } from "@/lib/document-api";
import { assetUrl, usePropertyResource, type LivePlot, type Page } from "@/lib/property-api";

function Overview() {
  const { data } = useAdmin();
  const { permissions } = useAdminAccess();
  const can = (section: string) => permissions.includes(section);
  const liveDocuments = usePropertyResource<DocumentPage>(
    "/admin/documents",
    true,
    can("documents"),
  );
  const livePlots = usePropertyResource<
    Page<LivePlot> & { stats: { total: number; published: number; drafts: number } }
  >("/admin/plots", true, can("plots"));
  const livePayments = usePropertyResource<ReservationPage>(
    "/admin/payments",
    true,
    can("payments"),
  );
  const liveReservations = usePropertyResource<ReservationPage>(
    "/admin/reservations",
    true,
    can("reservations"),
  );
  if (permissions.length === 1 && permissions.includes("dashboard"))
    return (
      <>
        <PageHead
          title="Your admin workspace"
          description="Open an assigned section to get started."
        />
        <Panel title="Your access">
          <p className="p-6">
            You currently have Overview access. Contact a Super Admin to request additional
            sections.
          </p>
        </Panel>
      </>
    );
  return (
    <>
      <PageHead
        eyebrow="YOUR OPERATIONS, AT A GLANCE"
        title="A clear view of your business."
        description="Manage listings, review reservations and follow confirmed payments."
        action={
          can("plots") && (
            <Button asChild>
              <Link href="/admin/plots/new">
                <Plus size={16} />
                Add a plot
              </Link>
            </Button>
          )
        }
      />
      <div className="admin-stat-grid">
        {[
          {
            label: "Total plots",
            value: livePlots.data?.stats.total ?? "…",
            note: "Saved listings",
            href: "/admin/plots",
            section: "plots",
          },
          {
            label: "Published plots",
            value: livePlots.data?.stats.published ?? "…",
            note: "Visible in the catalogue",
            href: "/admin/plots",
            section: "plots",
          },
          {
            label: "Active reservations",
            value: liveReservations.data?.stats.active ?? "…",
            note: "Confirmed reservations",
            href: "/admin/reservations",
            section: "reservations",
          },
          {
            label: "Confirmed collections",
            value: livePayments.data ? naira(livePayments.data.stats.confirmed) : "…",
            note: "Reservation payments",
            href: "/admin/payments",
            section: "payments",
          },
        ]
          .filter((item) => can(item.section))
          .map((item) => (
            <Link key={item.label} href={item.href} className="admin-stat">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>
                {item.note}
                <ArrowUpRight size={14} />
              </p>
            </Link>
          ))}
      </div>
      {[livePlots.error, livePayments.error, liveReservations.error]
        .filter(Boolean)
        .map((error, i) => (
          <p key={i} role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-800">
            {error}
          </p>
        ))}
      <div className="admin-overview-bottom">
        {can("documents") && (
          <Panel
            title="Documents"
            description="Uploaded files linked to plots and buyers."
            action={
              <Link href="/admin/documents" className="admin-text-link">
                Open documents
                <ArrowUpRight size={14} />
              </Link>
            }
          >
            <p className="p-6">
              {liveDocuments.error ||
                (liveDocuments.data
                  ? `${liveDocuments.data.stats.total} uploaded documents.`
                  : "Loading documents…")}
            </p>
          </Panel>
        )}
        {can("payments") && (
          <Panel
            title="Collections overview"
            description="Confirmed reservation payments."
            action={
              <Link href="/admin/payments" className="admin-text-link">
                Open payments
                <ArrowUpRight size={14} />
              </Link>
            }
          >
            <div className="p-6">
              <p className="text-3xl font-semibold">
                {livePayments.data ? naira(livePayments.data.stats.confirmed) : "…"}
              </p>
              <p className="mt-3 text-sm text-slate-700">
                Land purchase payments are separate from reservation fees.
              </p>
            </div>
          </Panel>
        )}
        {can("reservations") && (
          <Panel
            title="Recent reservations"
            description="Buyer checkout and reservation records from the database."
            action={
              <Link href="/admin/reservations" className="admin-text-link">
                View all
                <ArrowUpRight size={14} />
              </Link>
            }
          >
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Buyer / plot</th>
                    <th>Fee</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {liveReservations.data?.items.slice(0, 5).map((row) => (
                    <tr key={row.id}>
                      <td>
                        <p>{row.buyer?.name}</p>
                        <p>{row.plot.code}</p>
                      </td>
                      <td>{naira(row.amount)}</td>
                      <td>{row.status.replaceAll("_", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!liveReservations.loading && !liveReservations.data?.items.length && (
                <p className="p-5">No reservations yet. Buyer checkouts will appear here.</p>
              )}
            </div>
          </Panel>
        )}
        {can("plots") && (
          <Panel
            title="Your plot portfolio"
            description="Recent listings and publication status."
            action={
              <Link href="/admin/plots" className="admin-text-link">
                View all plots
                <ArrowUpRight size={14} />
              </Link>
            }
          >
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Plot</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {livePlots.data?.items.slice(0, 5).map((plot) => (
                    <tr key={plot.id}>
                      <td>
                        <Link href={"/admin/plots/" + plot.code} className="admin-text-link">
                          {plot.title || plot.code}
                        </Link>
                        <p>{plot.code}</p>
                      </td>
                      <td>{naira(Number(plot.price))}</td>
                      <td>
                        <Badge>{plot.publication}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!livePlots.loading && !livePlots.data?.items.length && (
                <p className="p-5">No listings yet. Add your first plot to get started.</p>
              )}
            </div>
          </Panel>
        )}
        {can("audit") && (
          <Panel title="Recent activity">
            <AdminRecentActivity />
          </Panel>
        )}
      </div>
    </>
  );
}

function PlotTable({ plots }: { plots: ReturnType<typeof useAdmin>["data"]["plots"] }) {
  return (
    <div className="admin-table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Plot</th>
            <th>Land price</th>
            <th>Availability</th>
            <th>Publication</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {plots.map((p) => (
            <tr key={p.code}>
              <td>
                <Link href={`/admin/plots/${p.code}`} className="admin-plot-cell">
                  <LocalPhoto id={p.photos[0]?.id} fallback={p.cover} alt={p.title} />
                  <span>
                    <strong>
                      {p.location || "Untitled plot"}, {p.state}
                    </strong>
                    <small>
                      {p.code} · {p.size} sqm
                    </small>
                  </span>
                </Link>
              </td>
              <td className="admin-money">{naira(p.price)}</td>
              <td>
                <Badge>{p.availability}</Badge>
              </td>
              <td>
                <Badge>{p.publication}</Badge>
              </td>
              <td>
                <Link href={`/admin/plots/${p.code}`} className="admin-text-link">
                  Manage <ArrowUpRight size={13} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Plots() {
  const { data } = useAdmin();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("All plots");
  const [state, setState] = useState("");
  const [availability, setAvailability] = useState("");
  const list = data.plots.filter(
    (p) =>
      (tab === "All plots" || p.publication === tab) &&
      (!state || p.state === state) &&
      (!availability || p.availability === availability) &&
      (p.code + p.title + p.location).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="Your plot portfolio"
        description="Create complete listings, manage availability and publish with confidence."
        action={
          <>
            <Button variant="outline" asChild>
              <Link href="/admin/catalogue">
                <Eye size={16} />
                Catalogue preview
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/plots/new">
                <Plus size={16} />
                Add plot
              </Link>
            </Button>
          </>
        }
      />
      <div className="admin-tabs">
        {["All plots", "Published", "Draft", "Archived"].map((v) => (
          <button key={v} className={tab === v ? "active" : ""} onClick={() => setTab(v)}>
            {v}
            <span>
              {v === "All plots"
                ? data.plots.length
                : data.plots.filter((p) => p.publication === v).length}
            </span>
          </button>
        ))}
      </div>
      <div className="admin-toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search plot code, title or location…" />
        <select aria-label="Filter state" value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">All states</option>
          <option>Lagos</option>
          <option>Ogun</option>
        </select>
        <select
          aria-label="Filter availability"
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
        >
          <option value="">All availability</option>
          <option>Available</option>
          <option>Reserved</option>
          <option>Sold</option>
        </select>
        <span className="admin-record-count">{list.length} plots</span>
      </div>
      <Panel>
        <PlotTable plots={list} />
        {!list.length && (
          <Empty
            title="No plots in this view"
            description="Adjust the search and filters, or create a new draft listing."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQ("");
                  setState("");
                  setAvailability("");
                  setTab("All plots");
                }}
              >
                Clear filters
              </Button>
            }
          />
        )}
      </Panel>
    </>
  );
}
export default function AdminWorkspace({ module = "dashboard" }: { module?: string }) {
  const modules: Record<string, React.ReactNode> = {
    dashboard: <Overview />,
    plots: <LiveAdminPlots />,
    documents: <LiveAdminDocuments />,
    customers: <LiveAdminBuyers />,
    reservations: <LiveAdminReservations />,
    payments: <LiveAdminReservations payments />,
    "site-checks": <AdminChecks />,
    "co-ownership": <LiveAdminCoOwnership />,
    announcements: <AdminAnnouncements />,
    staff: <AdminStaffAccess />,
    audit: <AdminAudit />,
    settings: <AdminSettings />,
    catalogue: <LiveAdminPlots catalogue />,
  };
  return (
    modules[module] || (
      <Empty
        title="Workspace not found"
        action={
          <Button asChild>
            <Link href="/admin">Back to overview</Link>
          </Button>
        }
      />
    )
  );
}
