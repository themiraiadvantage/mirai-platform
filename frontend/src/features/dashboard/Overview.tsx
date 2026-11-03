"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Wallet,
  ShieldCheck,
  CalendarDays,
  CircleCheck,
  Clock3,
  FileText,
  Plus,
  ChevronRight,
  Megaphone,
} from "lucide-react";
import { useSession } from "@/lib/session";
import { ALERTS, getPlot, naira, planSchedule, STAGES } from "@/lib/data";
import { useDemo } from "@/lib/demo-store";
import { EmptyState, ParcelSvg, ProgressRing, StatusChip } from "@/components/mirai/primitives";
import { Button } from "@/components/ui/button";
import { plotPhoto } from "@/lib/photos";
import { alertHref, buyerAlerts } from "@/lib/notifications";
import { useBuyerNotifications } from "@/components/mirai/BuyerNotifications";
import { announcementDate } from "@/lib/announcement-api";
import { CoOwnershipRecords } from "./CoOwnershipRecords";
import { usePropertyResource, type CoSummary } from "@/lib/property-api";
import type { ReservationPage } from "@/lib/reservation-api";
import { ReservationRecords } from "./ReservationRecords";

export default function Overview() {
  const notifications = useBuyerNotifications();
  const coSummary = usePropertyResource<CoSummary>("/co-ownership/summary");
  const reservations = usePropertyResource<ReservationPage>("/reservations");
  const session = useSession(),
    demo = useDemo();
  if (!demo) return <div className="h-80 animate-pulse rounded-2xl bg-card" />;
  const owned = demo.owned,
    paid =
      owned.reduce((a, o) => a + o.paid, 0) +
      Number(coSummary.data?.confirmed || 0) +
      (reservations.data?.stats.confirmed || 0),
    next = owned
      .flatMap((o) =>
        o.instalments.filter((i) => i.status === "Upcoming").map((i) => ({ ...i, code: o.code })),
      )
      .sort((a, b) => Date.parse(a.due) - Date.parse(b.due))[0];
  const alerts = buyerAlerts(
    owned.map((o) => o.code),
    undefined,
  ).filter((a) => a.type !== "announcement");
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="mb-3 text-xs font-medium uppercase tracking-[.2em] text-gold">
            {session?.role === "partner"
              ? "Your co-ownership workspace"
              : session?.role === "developer"
                ? "Your developer workspace"
                : "Your ownership workspace"}
          </div>
          <h1 className="text-3xl md:text-[42px]">
            Hello, {session?.name.trim().split(/\s+/)[0] || "there"}{" "}
            <span
              role="img"
              aria-label="Waving hand"
              className="inline-block align-middle text-[.7em]"
            >
              👋
            </span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Manage your plots, payments and ownership progress in one place.
          </p>
        </div>
        <Button asChild variant="outline" className="mt-2">
          <Link href="/dashboard/explore">
            <Plus size={16} />
            Explore plots
          </Link>
        </Button>
      </div>
      <CoOwnershipRecords compact />
      <ReservationRecords compact />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Plots in your library",
            value: String(
              owned.length +
                (coSummary.data?.active || 0) +
                (coSummary.data?.allocated || 0) +
                (reservations.data?.stats.active || 0),
            ).padStart(2, "0"),
            sub: "Reserved plots and ownership records",
            Icon: MapPin,
          },
          {
            label: "Total paid",
            value: naira(paid),
            sub: "Every payment has a record",
            Icon: Wallet,
          },
          {
            label: "Ownership in progress",
            value: String(
              owned.filter((o) => o.stage !== "Complete").length +
                (reservations.data?.stats.active || 0) +
                (coSummary.data?.active || 0),
            ).padStart(2, "0"),
            sub: "Reservation through to final documents",
            Icon: ShieldCheck,
          },
          {
            label: "Next instalment",
            value: next ? naira(next.amount) : "All clear",
            sub: next ? `${next.due} · ${next.code}` : "No upcoming payments",
            Icon: CalendarDays,
          },
        ].map(({ label, value, sub, Icon }) => (
          <div key={label} className="surface p-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {label}
              <Icon size={17} strokeWidth={1.5} className="text-low" />
            </div>
            <div className="mt-5 num text-[28px] font-medium tracking-tight">{value}</div>
            <div className="mt-2 text-xs text-low">{sub}</div>
          </div>
        ))}
      </div>
      {owned.some((o) => o.instalments.some((i) => i.status === "Overdue")) && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-warning/25 bg-warning/5 px-5 py-4">
          <Clock3 size={18} className="text-warning" />
          <p className="flex-1 text-xs text-muted-foreground">
            <span className="font-medium text-warning">A payment needs your attention.</span> Your
            August instalment for MR-4092 is overdue. No hidden penalty fees have been added.
          </p>
          <Link
            href="/dashboard/plots/MR-4092"
            className="flex items-center gap-2 text-xs text-warning"
          >
            Review payment <ArrowRight size={14} />
          </Link>
        </div>
      )}
      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_330px]">
        <div className="min-w-0 space-y-7">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl">Your land, at a glance</h2>
              <Link
                href="/dashboard/library"
                className="flex items-center gap-2 text-xs text-primary-bright"
              >
                View library <ArrowUpRight size={14} />
              </Link>
            </div>
            {owned.length === 0 &&
            !(
              reservations.data?.stats.active ||
              coSummary.data?.active ||
              coSummary.data?.allocated
            ) ? (
              <div>
                <EmptyState
                  title="You haven’t reserved any plots yet."
                  cta={
                    <Button asChild>
                      <Link href="/dashboard/explore">Explore plots</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="space-y-4">
                {!!reservations.data?.stats.active && (
                  <div className="surface p-6">
                    <p className="text-lg font-semibold">
                      {reservations.data.stats.active} active reservation
                      {reservations.data.stats.active === 1 ? "" : "s"}
                    </p>
                    <p className="mt-3 text-sm text-slate-700">
                      Your reservation details and payment history are saved in your Land Library.
                    </p>
                    <Button className="mt-4" variant="outline" asChild>
                      <Link href="/dashboard/library">Open reserved plots</Link>
                    </Button>
                  </div>
                )}
                {!!(coSummary.data?.active || coSummary.data?.allocated) && (
                  <Button asChild variant="outline">
                    <Link href="/dashboard/co-own">Open your co-ownership records</Link>
                  </Button>
                )}
                {owned.map((o, idx) => {
                  const p = getPlot(o.code)!;
                  const progress = (STAGES.indexOf(o.stage) + 1) * 20;
                  return (
                    <Link
                      href={`/dashboard/plots/${o.code}`}
                      key={o.code}
                      className="surface group block overflow-hidden transition-colors hover:border-primary/60 sm:flex"
                    >
                      <div className="relative h-40 overflow-hidden sm:h-auto sm:w-40 sm:shrink-0">
                        <img
                          src={plotPhoto(p.photo)}
                          alt={`Illustrative landscape for ${p.location}`}
                          className="h-full w-full object-cover opacity-75 transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
                        <span className="absolute bottom-3 left-3 font-mono text-xs text-white">
                          {p.code}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-widest text-low">
                              {p.state} · {p.size} sqm
                            </div>
                            <h3 className="mt-1 text-xl">
                              {p.location}, {p.state}
                            </h3>
                          </div>
                          <span className="rounded-full border border-gold/20 bg-gold/5 px-2.5 py-1 text-xs text-gold">
                            {o.stage}
                          </span>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-2">
                          <StatusChip status={p.status} />
                          <span className="num text-xs text-muted-foreground">
                            {naira(o.paid)} <span className="text-low">paid</span>
                          </span>
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
                            <div
                              className="h-full rounded-full bg-primary-bright"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="num text-xs text-low">{progress}%</span>
                          <ChevronRight size={14} className="text-low" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
          <section className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-5">
              <h2 className="text-xl">Your ownership journey</h2>
              <span className="text-xs uppercase tracking-widest text-low">
                A clear path forward
              </span>
            </div>
            <p className="px-6 pt-5 text-xs text-low">
              Each plot has its own progress. Open its record for the current stage and next action.
            </p>
            <div className="grid gap-4 p-6 sm:grid-cols-5">
              {STAGES.map((s, i) => (
                <div key={s} className="relative">
                  <div className="mb-3 grid size-8 place-items-center rounded-full border border-border text-low">
                    <span className="num text-xs">0{i + 1}</span>
                  </div>
                  <p className="text-xs">{s}</p>
                  <p className="mt-1 text-xs leading-relaxed text-low">
                    {
                      [
                        "Your plot, held for you",
                        "Checks with evidence",
                        "Clear instalment records",
                        "Your paperwork, tracked",
                        "Ownership with proof",
                      ][i]
                    }
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="space-y-5">
          <div className="surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl">Activity & updates</h2>
              <span className="size-1.5 rounded-full bg-primary-bright" />
            </div>
            <div className="mt-5 space-y-5">
              {notifications.items.slice(0, 3).map((item) => (
                <Link href="/dashboard/notifications" key={item.id} className="flex gap-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-overlay text-gold">
                    <Megaphone size={14} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-relaxed">{item.announcement.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.kind === "activity" ? "Ownership update" : "MIRAI announcement"} ·{" "}
                      {announcementDate(item.createdAt)}
                    </p>
                  </div>
                </Link>
              ))}
              {alerts
                .slice(0, Math.max(0, 4 - Math.min(3, notifications.items.length)))
                .map((a) => (
                  <Link href={alertHref(a)} key={a.id} className="flex gap-3">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-overlay">
                      {a.type === "payment" ? (
                        <Wallet size={14} className="text-gold" />
                      ) : a.type === "document" ? (
                        <FileText size={14} className="text-info" />
                      ) : (
                        <ShieldCheck size={14} className="text-primary-bright" />
                      )}
                    </span>
                    <div>
                      <p className="text-xs leading-relaxed">{a.title}</p>
                      <p className="mt-1 text-xs text-low">
                        {a.code} · {a.time}
                      </p>
                    </div>
                  </Link>
                ))}
              {!alerts.length && !notifications.items.length && (
                <p className="text-xs text-muted-foreground">
                  Announcements and property updates will appear here.
                </p>
              )}
            </div>
            <Link
              href="/dashboard/notifications"
              className="mt-6 flex items-center justify-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground"
            >
              All notifications <ArrowRight size={13} />
            </Link>
          </div>
          <div className="contour-bg rounded-2xl border border-gold/20 bg-gold/[.03] p-6">
            <ShieldCheck size={27} strokeWidth={1.3} className="text-gold" />
            <h3 className="mt-4 text-2xl">
              Know what’s checked.
              <br />
              <em className="text-gold">And what isn’t.</em>
            </h3>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Every finding has a source, a date, and a reviewer. Because confidence starts with
              clarity.
            </p>
            <Link
              href="/dashboard/guide#checks"
              className="mt-5 inline-flex items-center gap-2 text-xs text-gold"
            >
              Our verification approach <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="px-2 text-xs leading-relaxed text-low">
            Demo workspace · All land, payment and verification records shown here are illustrative.
          </div>
        </aside>
      </div>
    </>
  );
}
