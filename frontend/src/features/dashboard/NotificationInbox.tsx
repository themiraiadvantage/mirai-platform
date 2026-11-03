"use client";
import Link from "next/link";
import { useState } from "react";
import { Bell, Check, CheckCheck, Megaphone, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBuyerNotifications } from "@/components/mirai/BuyerNotifications";
import { EmptyState } from "@/components/mirai/primitives";
import { announcementDate, type BuyerNotification } from "@/lib/announcement-api";
import { buyerAlerts, alertHref } from "@/lib/notifications";
import { useDemo, mutateDemo } from "@/lib/demo-store";
import { useSession } from "@/lib/session";

export function NotificationInbox() {
  const inbox = useBuyerNotifications();
  const session = useSession();
  const demo = useDemo();
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState<BuyerNotification | null>(null);
  const [selectedFor, setSelectedFor] = useState<string>();
  const [readerError, setReaderError] = useState("");
  const [busy, setBusy] = useState(false);
  const activities = buyerAlerts(demo?.owned.map((o) => o.code) || [], undefined).filter(
    (a) => a.type !== "announcement",
  );
  const activityUnread = activities.filter((a) => a.unread && !demo?.read.includes(a.id)).length;
  const totalUnread = inbox.unreadCount + activityUnread;
  const live = inbox.items.filter(
    (item) =>
      tab === "all" || (tab === "activity" ? item.kind === "activity" : item.kind !== "activity"),
  );
  const activity = tab === "announcement" ? [] : activities;
  const reader =
    selected && selectedFor === session?.id
      ? (inbox.items.find((item) => item.id === selected.id) ?? selected)
      : null;
  async function read(item: BuyerNotification, open = false) {
    if (open) {
      setSelected(item);
      setSelectedFor(session?.id);
      setReaderError("");
    }
    if (item.readAt) return;
    try {
      await inbox.markRead(item.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not mark this update as read.";
      if (open) setReaderError(message);
      else toast.error(message);
    }
  }
  async function readAll() {
    if (busy) return;
    setBusy(true);
    try {
      if (inbox.unreadCount) await inbox.markAllRead();
      if (activityUnread)
        mutateDemo((state) => ({
          ...state,
          read: [...new Set([...state.read, ...activities.map((a) => a.id)])],
        }));
      toast.success("All notifications marked as read");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update notifications.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="notification-heading">
        <div>
          <p className="eyebrow">Your updates, in one place</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="page-title">Notifications</h1>
            {totalUnread > 0 && (
              <span className="notification-unread-count">{totalUnread} unread</span>
            )}
          </div>
          <p className="page-subtitle">
            Announcements from MIRAI and updates on your ownership journey.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={inbox.loading}
            onClick={() => void inbox.refresh()}
            aria-label="Refresh notifications"
          >
            <RefreshCw size={16} />
          </Button>
          <Button
            variant="outline"
            disabled={busy || totalUnread === 0}
            onClick={() => void readAll()}
          >
            <CheckCheck size={16} />
            {busy ? "Updating…" : "Mark all as read"}
          </Button>
        </div>
      </div>
      <div className="notification-tabs" role="group" aria-label="Filter notifications">
        {[
          ["all", "All updates"],
          ["announcement", "Announcements"],
          ["activity", "Property activity"],
        ].map(([value, label]) => (
          <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>
            {label}
          </button>
        ))}
      </div>
      {inbox.error && (
        <div className="notification-error" role="alert">
          <p>{inbox.error}</p>
          <Button variant="outline" onClick={() => void inbox.refresh()}>
            Try again
          </Button>
        </div>
      )}
      {inbox.loading && !inbox.items.length && tab !== "activity" ? (
        <div className="space-y-4" role="status" aria-label="Loading notifications">
          {[1, 2, 3].map((i) => (
            <div key={i} className="surface h-36 animate-pulse bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="notification-list">
          {live.map((item) => (
            <article
              key={item.id}
              className={`notification-card ${!item.readAt ? "is-unread" : ""}`}
            >
              <span className="notification-icon">
                <Megaphone size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="notification-card-meta">
                  <span>
                    {item.kind === "activity" ? "Ownership update" : "MIRAI announcement"}
                  </span>
                  <time dateTime={item.createdAt}>{announcementDate(item.createdAt)}</time>
                </div>
                <button className="notification-title" onClick={() => void read(item, true)}>
                  {item.announcement.title}
                </button>
                <p className="notification-excerpt">{item.announcement.body}</p>
                <div className="notification-actions">
                  <button onClick={() => void read(item, true)}>
                    {item.kind === "activity" ? "Read update" : "Read announcement"}{" "}
                    <span aria-hidden="true">→</span>
                  </button>
                  {!item.readAt ? (
                    <button className="notification-mark-read" onClick={() => void read(item)}>
                      <Check size={14} />
                      Mark as read
                    </button>
                  ) : (
                    <span>
                      <CheckCheck size={14} />
                      Read
                    </span>
                  )}
                </div>
                {item.kind === "activity" && item.href === "/dashboard/co-own" && (
                  <Link className="mt-3 inline-block text-sm font-semibold" href={item.href}>
                    Open co-ownership →
                  </Link>
                )}
                {item.kind === "activity" && item.href === "/dashboard/payments" && (
                  <Link
                    href="/dashboard/payments"
                    className="mt-3 inline-block text-sm font-medium underline"
                  >
                    Open payments →
                  </Link>
                )}
                {item.kind === "activity" && item.href === "/dashboard/documents" && (
                  <Link
                    href="/dashboard/documents"
                    className="mt-3 inline-block text-sm font-medium underline"
                  >
                    Open document vault →
                  </Link>
                )}
              </div>
              {!item.readAt && <span className="notification-unread-dot" aria-label="Unread" />}
            </article>
          ))}
          {activity.map((item) => {
            const unread = item.unread && !demo?.read.includes(item.id);
            return (
              <article key={item.id} className={`notification-card ${unread ? "is-unread" : ""}`}>
                <span className="notification-icon">
                  <Bell size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="notification-card-meta">
                    <span>Property update · {item.code}</span>
                    <span>{item.time}</span>
                  </div>
                  <h2 className="notification-title">{item.title}</h2>
                  <p className="notification-excerpt">{item.body}</p>
                  <div className="notification-actions">
                    <Link href={alertHref(item)}>View plot update →</Link>
                    {unread && (
                      <button
                        className="notification-mark-read"
                        onClick={() =>
                          mutateDemo((state) => ({
                            ...state,
                            read: [...new Set([...state.read, item.id])],
                          }))
                        }
                      >
                        <Check size={14} />
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
          {!live.length && !activity.length && !inbox.error && (
            <EmptyState
              title={tab === "announcement" ? "No announcements yet" : "You’re all caught up."}
              cta={
                <p className="text-sm text-muted-foreground">
                  New announcements and relevant updates will appear here.
                </p>
              }
            />
          )}
          {inbox.nextCursor && (
            <div className="pt-3 text-center">
              <Button
                variant="outline"
                disabled={inbox.loadingMore}
                onClick={() => void inbox.loadMore()}
              >
                {inbox.loadingMore ? "Loading…" : "Load older notifications"}
              </Button>
            </div>
          )}
        </div>
      )}
      <Dialog
        open={Boolean(reader)}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setReaderError("");
          }
        }}
      >
        <DialogContent className="notification-reader max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          {reader && (
            <>
              <div className="notification-reader-label">
                <Megaphone size={18} />
                {reader.kind === "activity" ? "Ownership update" : "MIRAI announcement"}
              </div>
              <DialogHeader>
                <DialogTitle className="text-2xl leading-tight">
                  {reader.announcement.title}
                </DialogTitle>
                <DialogDescription>{announcementDate(reader.createdAt)}</DialogDescription>
              </DialogHeader>
              <p className="notification-reader-body">{reader.announcement.body}</p>
              {readerError && (
                <div className="notification-error" role="alert">
                  <p>{readerError}</p>
                  <Button variant="outline" onClick={() => void read(reader, true)}>
                    Retry
                  </Button>
                </div>
              )}
              <div className="notification-reader-footer">
                <span>
                  <CheckCheck size={16} />
                  {reader.readAt ? "Read" : "Marking as read…"}
                </span>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
