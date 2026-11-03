"use client";
import { BuyerPersonalDetails } from "./BuyerPersonalDetails";
import { ReservationRecords } from "./ReservationRecords";
import { CoOwnershipRecords } from "./CoOwnershipRecords";
import { usePropertyResource, type CoSummary } from "@/lib/property-api";
import Link from "next/link";
import { useState } from "react";
import {
  Bell,
  CheckCheck,
  FileText,
  Download,
  Users,
  ShieldCheck,
  ArrowRight,
  Search,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { useDemo, mutateDemo, downloadReceipt } from "@/lib/demo-store";
import { ALERTS, getPlot, naira, planSchedule } from "@/lib/data";
import { alertHref, buyerAlerts } from "@/lib/notifications";
import { useSession, updateSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/mirai/primitives";
import type { ReservationPage } from "@/lib/reservation-api";
import { downloadDocument } from "@/lib/document-api";
import { reservationDate } from "@/lib/reservation-api";

export { NotificationInbox as Notifications } from "./NotificationInbox";

export function Payments() {
  return (
    <>
      <p className="eyebrow">A record for every naira</p>
      <h1 className="page-title">Payments & receipts</h1>
      <p className="page-subtitle">Track your reservation payments and download receipts.</p>
      <ReservationRecords payments />
      <CoOwnershipRecords />
    </>
  );
}

export function Documents() {
  const demo = useDemo();
  const coSummary = usePropertyResource<CoSummary>("/co-ownership/summary");
  const reservations = usePropertyResource<ReservationPage>("/reservations?status=ACTIVE");
  const [documentCursor, setDocumentCursor] = useState("");
  const assigned = usePropertyResource<{
    items: {
      id: string;
      name: string;
      category: string;
      fileVersion: number;
      createdAt: string;
      updatedAt: string;
      plot: { code: string; title: string };
    }[];
    total: number;
    nextCursor: string | null;
  }>(`/documents${documentCursor ? `?cursor=${documentCursor}` : ""}`);
  return (
    <>
      <p className="eyebrow">Your proof, in one place</p>
      <h1 className="page-title">Document vault</h1>
      <p className="page-subtitle">
        Your plot documents and files shared by MIRAI, together in one place.
      </p>
      <CoOwnershipRecords documents />
      {assigned.error && (
        <div role="alert" className="surface mt-6 p-5">
          <p>{assigned.error}</p>
          <Button variant="outline" className="mt-3" onClick={assigned.refresh}>
            Try again
          </Button>
        </div>
      )}
      {!!assigned.data?.items.length && (
        <section className="surface mt-7 p-6">
          <h2 className="text-2xl">Documents shared with you</h2>
          <p className="mt-3 text-sm text-slate-700">
            Files shared with you by MIRAI for your plot records.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {assigned.data.items.map((d) => (
              <article key={d.id} className="rounded-xl border p-5">
                <FileText size={20} className="text-amber-800" />
                <p className="mt-3 font-mono text-xs text-amber-800">{d.plot.code}</p>
                <h3 className="mt-2 text-lg font-semibold">{d.name}</h3>
                <p className="mt-2 text-sm text-slate-700">
                  {d.category} · v{d.fileVersion}
                </p>
                <p className="mt-2 text-xs text-slate-700">
                  Uploaded {reservationDate(d.createdAt)}
                </p>
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() =>
                    void downloadDocument(`/documents/${d.id}/download`, d.name).catch((e) =>
                      toast.error(e.message),
                    )
                  }
                >
                  <Download size={15} />
                  Download document
                </Button>
              </article>
            ))}
          </div>
          <div className="mt-5 flex gap-3">
            {documentCursor && (
              <Button variant="outline" onClick={() => setDocumentCursor("")}>
                First page
              </Button>
            )}
            {assigned.data.nextCursor && (
              <Button
                variant="outline"
                onClick={() => setDocumentCursor(assigned.data!.nextCursor!)}
              >
                More documents
              </Button>
            )}
          </div>
        </section>
      )}
      {!!reservations.data?.items.length && (
        <section className="surface mt-7 p-6">
          <h2 className="text-2xl">Reserved plot documents</h2>
          <p className="mt-3 text-sm text-slate-700">
            Open the listing documents for your reserved plots. Ownership and allocation documents
            follow the purchase process.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {reservations.data.items.map((row) => (
              <article key={row.id} className="rounded-xl border p-5">
                <p className="font-mono text-sm text-amber-800">{row.plot.code}</p>
                <h3 className="mt-2 text-lg font-semibold">{row.plot.title}</h3>
                <Button className="mt-4" variant="outline" asChild>
                  <Link href={`/dashboard/explore/${row.plot.code}#listing-documents`}>
                    <FileText size={16} />
                    Open listing documents
                  </Link>
                </Button>
              </article>
            ))}
          </div>
        </section>
      )}
      <div className="mt-8 space-y-5">
        {demo?.owned.map((o) => {
          const p = getPlot(o.code)!;
          return (
            <section key={o.code} className="surface p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="font-mono text-xs text-gold">{o.code}</span>
                  <h2 className="mt-1 text-2xl">
                    {p.location}, {p.state}
                  </h2>
                </div>
                <Button asChild variant="outline">
                  <Link href={`/dashboard/plots/${o.code}?tab=documents`}>
                    Open full vault <ArrowRight size={15} />
                  </Link>
                </Button>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {p.docs.map((d) => (
                  <div
                    key={d.name}
                    className={`rounded-xl border p-4 ${d.status === "available" ? "border-border" : "border-dashed border-warning/30"}`}
                  >
                    <FileText size={18} className="text-gold" />
                    <p className="mt-3 text-sm">{d.name}</p>
                    <p className="mt-1 text-xs text-low">
                      {d.reviewer} · {d.reviewed || "Awaiting review"}
                    </p>
                    <span
                      className={`status-dot mt-3 ${d.status === "available" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}
                    >
                      {d.status === "available"
                        ? "Available"
                        : d.status === "review"
                          ? "Under review"
                          : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        {!demo?.owned.length &&
          !coSummary.data?.allocated &&
          !reservations.data?.stats.active &&
          !assigned.data?.total && (
            <EmptyState
              title="Your documents will live here after you reserve a plot."
              cta={
                <Button asChild>
                  <Link href="/dashboard/explore">Explore plots</Link>
                </Button>
              }
            />
          )}
      </div>
    </>
  );
}

export { BuyerCoOwnership as Matching } from "./BuyerCoOwnership";

export function Profile() {
  const session = useSession(),
    demo = useDemo(),
    [name, setName] = useState(session?.name || ""),
    [phone, setPhone] = useState(session?.phone || ""),
    [role, setRole] = useState(session?.role || "buyer");
  return (
    <>
      <p className="eyebrow">Make yourself at home</p>
      <h1 className="page-title">Your profile</h1>
      <p className="page-subtitle">Your details, preferences, and workspace.</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <BuyerPersonalDetails />
        <div className="space-y-6">
          <section className="surface p-6">
            <h2 className="text-2xl">Notification preferences</h2>
            <p className="mt-2 text-xs text-low">
              Saved locally for this demo. Messages are not sent.
            </p>
            {["email", "SMS", "WhatsApp"].map((p) => (
              <div key={p} className="mt-5 flex items-center justify-between">
                <Label htmlFor={`pref-${p}`} className="capitalize">
                  {p} updates
                </Label>
                <Switch
                  id={`pref-${p}`}
                  checked={demo?.preferences[p] || false}
                  onCheckedChange={(checked) => {
                    mutateDemo((s) => ({ ...s, preferences: { ...s.preferences, [p]: checked } }));
                    toast.success("Preference saved");
                  }}
                />
              </div>
            ))}
          </section>
          <section className="surface p-6">
            <h2 className="text-2xl">Session & security</h2>
            <p className="mt-3 text-sm">
              This browser <span className="ml-2 text-xs text-success">Signed in</span>
            </p>
            <p className="mt-2 text-xs text-low">Last login: {session?.lastLogin}</p>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Your email is verified and your session is secured. Password changes and two-factor
              authentication are not available yet.
            </p>
            <Link href="/privacy" className="mt-4 inline-block text-xs text-primary-bright">
              How your data should be handled →
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}
