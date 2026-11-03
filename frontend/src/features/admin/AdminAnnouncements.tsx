"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  ChevronRight,
  Eye,
  Megaphone,
  Plus,
  RefreshCw,
  Send,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  authenticatedRequest,
  announcementDate,
  type AnnouncementPage,
  type BuyerOption,
  type LiveAnnouncement,
} from "@/lib/announcement-api";
import { Badge, Empty, Field, Modal, PageHead, Panel } from "./admin-ui";

type Composer = {
  id?: string;
  title: string;
  body: string;
  audience: "ALL_BUYERS" | "SELECTED_BUYERS";
  selectedBuyers: BuyerOption[];
  published?: LiveAnnouncement;
};
const blank = (): Composer => ({ title: "", body: "", audience: "ALL_BUYERS", selectedBuyers: [] });

export function AdminAnnouncements() {
  const [page, setPage] = useState<AnnouncementPage>({
    items: [],
    nextCursor: null,
    stats: { drafts: 0, published: 0, delivered: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [composer, setComposer] = useState<Composer | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [buyers, setBuyers] = useState<BuyerOption[]>([]);
  const [buyerTotal, setBuyerTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [buyerLoading, setBuyerLoading] = useState(false);
  const [buyerError, setBuyerError] = useState("");
  const [filter, setFilter] = useState("all");
  const loadVersion = useRef(0);
  const savedDraft = useRef<{ id: string; body: string } | null>(null);

  const load = useCallback(
    async (cursor?: string) => {
      const version = ++loadVersion.current;
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      try {
        const query = new URLSearchParams();
        if (cursor) query.set("cursor", cursor);
        if (filter !== "all") query.set("status", filter);
        const response = await authenticatedRequest<AnnouncementPage>(
          `/admin/announcements${query.size ? `?${query}` : ""}`,
        );
        if (version !== loadVersion.current) return;
        setPage((previous) =>
          cursor
            ? {
                ...response,
                items: [
                  ...previous.items,
                  ...response.items.filter(
                    (item) => !previous.items.some((old) => old.id === item.id),
                  ),
                ],
              }
            : response,
        );
        setError("");
      } catch (e) {
        if (version === loadVersion.current)
          setError(e instanceof Error ? e.message : "Could not load announcements.");
      } finally {
        if (version === loadVersion.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [filter],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const editing = Boolean(composer && !composer.published);
  useEffect(() => {
    if (!editing) return;
    let active = true;
    setBuyerLoading(true);
    setBuyerError("");
    const timer = setTimeout(() => {
      authenticatedRequest<{ items: BuyerOption[]; total: number }>(
        `/admin/announcements/buyers?q=${encodeURIComponent(search)}`,
      )
        .then((result) => {
          if (active) {
            setBuyers(result.items);
            if (!search.trim()) setBuyerTotal(result.total);
          }
        })
        .catch((e) => {
          if (active) setBuyerError(e instanceof Error ? e.message : "Could not load buyers.");
        })
        .finally(() => {
          if (active) setBuyerLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [editing, search]);
  function open(item?: LiveAnnouncement) {
    savedDraft.current = null;
    setComposer(
      item
        ? {
            id: item.id,
            title: item.title,
            body: item.body,
            audience: item.audience,
            selectedBuyers: item.selectedBuyers,
            ...(item.status === "PUBLISHED" ? { published: item } : {}),
          }
        : blank(),
    );
    setPreview(item?.status === "PUBLISHED");
    setSaveError("");
    setSearch("");
  }
  const canSave = Boolean(
    composer?.title.trim() &&
    composer.body.trim() &&
    (composer.audience === "ALL_BUYERS" || composer.selectedBuyers.length),
  );
  async function save(publish = false) {
    if (!composer || !canSave || busy || composer.published) return;
    setBusy(true);
    setSaveError("");
    let draftId = composer.id;
    try {
      const body = JSON.stringify({
        title: composer.title,
        body: composer.body,
        audience: composer.audience,
        buyerIds:
          composer.audience === "SELECTED_BUYERS" ? composer.selectedBuyers.map((b) => b.id) : [],
      });
      if (!draftId || savedDraft.current?.id !== draftId || savedDraft.current.body !== body) {
        const saved = await authenticatedRequest<{ id: string }>(
          `/admin/announcements${draftId ? `/${draftId}` : ""}`,
          { method: "POST", body },
        );
        draftId = saved.id;
        savedDraft.current = { id: saved.id, body };
      }
      setComposer((current) => (current ? { ...current, id: draftId } : current));
      if (publish)
        await authenticatedRequest(`/admin/announcements/${draftId}/publish`, { method: "POST" });
      setComposer(null);
      toast.success(
        publish ? "Announcement published. Buyer notifications are ready." : "Draft saved",
      );
      await load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save this announcement.");
    } finally {
      setBusy(false);
    }
  }
  const visible = page.items.filter((item) => filter === "all" || item.status === filter);
  return (
    <>
      <PageHead
        title="Announcements"
        description="Keep buyers informed with clear, relevant updates in their notifications."
        action={
          <>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={16} />
              Refresh
            </Button>
            <Button onClick={() => open()}>
              <Plus size={16} />
              Create announcement
            </Button>
          </>
        }
      />
      <div className="admin-announcement-stats">
        {[
          ["Drafts", page.stats.drafts],
          ["Published", page.stats.published],
          ["Notifications delivered", page.stats.delivered],
        ].map(([label, value]) => (
          <div key={label} className="admin-announcement-stat">
            <p>{label}</p>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="admin-announcement-tabs" role="group" aria-label="Filter announcements">
        {[
          ["all", "All announcements"],
          ["DRAFT", "Drafts"],
          ["PUBLISHED", "Published"],
        ].map(([value, label]) => (
          <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
            {label}
          </button>
        ))}
      </div>
      {error && (
        <div className="admin-callout mb-5" role="alert">
          <p>{error}</p>
          <Button variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}
      {loading ? (
        <div className="admin-announcement-grid" role="status" aria-label="Loading announcements">
          {[1, 2, 3].map((i) => (
            <div key={i} className="admin-panel h-64 animate-pulse bg-slate-100" />
          ))}
        </div>
      ) : (
        <>
          <div className="admin-announcement-grid">
            {visible.map((item) => (
              <Panel key={item.id}>
                <div className="admin-panel-body admin-announcement-card">
                  <div className="flex items-center justify-between">
                    <span className="admin-module-icon">
                      <Megaphone size={19} />
                    </span>
                    <Badge>{item.status === "DRAFT" ? "Draft" : "Published"}</Badge>
                  </div>
                  <p className="admin-announcement-audience">
                    <Users size={14} />
                    {item.audience === "ALL_BUYERS"
                      ? "All buyers"
                      : `${item.buyerIds.length} selected buyer${item.buyerIds.length === 1 ? "" : "s"}`}
                  </p>
                  <h2>{item.title}</h2>
                  <p className="admin-announcement-excerpt">{item.body}</p>
                  <div className="admin-announcement-delivery">
                    {item.status === "PUBLISHED" ? (
                      <>
                        <span>
                          <Check size={14} />
                          {item.recipientCount} delivered
                        </span>
                        <span>
                          <Eye size={14} />
                          {item.readCount} read
                        </span>
                      </>
                    ) : (
                      <span>Only visible to your admin team</span>
                    )}
                  </div>
                  <div className="admin-announcement-card-bottom">
                    <small>{announcementDate(item.publishedAt ?? item.createdAt)}</small>
                    <button className="admin-text-link" onClick={() => open(item)}>
                      {item.status === "DRAFT" ? "Edit draft" : "View announcement"}
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              </Panel>
            ))}
          </div>
          {!visible.length && !error && (
            <Panel>
              <Empty
                title={
                  filter === "DRAFT"
                    ? "No drafts yet"
                    : filter === "PUBLISHED"
                      ? "No published announcements"
                      : "Your next update starts here"
                }
                description="Create an announcement, choose who should receive it, and review it before publishing."
                action={
                  <Button onClick={() => open()}>
                    <Plus size={16} />
                    Create announcement
                  </Button>
                }
              />
            </Panel>
          )}
          {page.nextCursor && (
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                disabled={loadingMore}
                onClick={() => void load(page.nextCursor!)}
              >
                {loadingMore ? "Loading…" : "Load more announcements"}
              </Button>
            </div>
          )}
        </>
      )}
      <Modal
        open={Boolean(composer)}
        onClose={() => {
          if (!busy) setComposer(null);
        }}
        wide
        title={
          composer?.published
            ? "Announcement details"
            : composer?.id
              ? "Edit announcement"
              : "Create announcement"
        }
        description={
          composer?.published
            ? "A permanent record of the message delivered to buyers."
            : "Write your message, choose the audience, then review it before publishing."
        }
      >
        {composer && (
          <form
            className="admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            {!composer.published && (
              <div className="admin-composer-steps" role="group" aria-label="Announcement view">
                <button
                  type="button"
                  aria-pressed={!preview}
                  disabled={busy}
                  onClick={() => setPreview(false)}
                >
                  1. Compose
                </button>
                <button
                  type="button"
                  aria-pressed={preview}
                  disabled={busy}
                  onClick={() => setPreview(true)}
                >
                  2. Review
                </button>
              </div>
            )}
            {preview ? (
              <>
                <article className="admin-announcement-preview">
                  <div className="admin-announcement-preview-label">
                    <Megaphone size={18} />
                    MIRAI announcement
                  </div>
                  <h3>{composer.title || "Your announcement title"}</h3>
                  <p>{composer.body || "Your message will appear here."}</p>
                </article>
                <div className="admin-callout">
                  <Bell size={18} />
                  <div>
                    <strong>
                      {composer.audience === "ALL_BUYERS"
                        ? "All buyers"
                        : `${composer.selectedBuyers.length} selected buyer${composer.selectedBuyers.length === 1 ? "" : "s"}`}
                    </strong>
                    <p>
                      {composer.published
                        ? `${composer.published.recipientCount} notifications delivered · ${composer.published.readCount} read`
                        : "Publishing delivers this message to the selected audience in their dashboard notifications."}
                    </p>
                  </div>
                </div>
                {composer.selectedBuyers.length > 0 && (
                  <div className="admin-recipient-chips">
                    {composer.selectedBuyers.map((b) => (
                      <span key={b.id}>{b.name}</span>
                    ))}
                  </div>
                )}
                {!composer.published && (
                  <p className="text-sm text-muted-foreground">
                    Published announcements cannot be edited. Check your message and audience before
                    continuing.
                  </p>
                )}
              </>
            ) : (
              <>
                <Field label="Title">
                  <input
                    required
                    maxLength={160}
                    placeholder="A clear title for your update"
                    value={composer.title}
                    disabled={busy}
                    onChange={(e) => setComposer({ ...composer, title: e.target.value })}
                  />
                </Field>
                <Field label="Message">
                  <textarea
                    required
                    rows={7}
                    maxLength={10000}
                    placeholder="Tell buyers what’s happening, what they need to know, and any next steps."
                    value={composer.body}
                    disabled={busy}
                    onChange={(e) => setComposer({ ...composer, body: e.target.value })}
                  />
                </Field>
                <small className="text-right text-muted-foreground">
                  {composer.body.length.toLocaleString()} / 10,000 characters
                </small>
                <fieldset className="admin-audience-fieldset" disabled={busy}>
                  <legend>Who should receive this?</legend>
                  <div className="admin-audience-options">
                    {[
                      [
                        "ALL_BUYERS",
                        "All buyers",
                        "Every verified buyer account at the time of publishing.",
                      ],
                      [
                        "SELECTED_BUYERS",
                        "Selected buyers",
                        "Choose the buyers who need this update.",
                      ],
                    ].map(([value, label, hint]) => (
                      <label
                        key={value}
                        className={composer.audience === value ? "is-selected" : ""}
                      >
                        <input
                          type="radio"
                          name="audience"
                          value={value}
                          checked={composer.audience === value}
                          onChange={() =>
                            setComposer({ ...composer, audience: value as Composer["audience"] })
                          }
                        />
                        <span>
                          <strong>{label}</strong>
                          <small>{hint}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  {composer.audience === "SELECTED_BUYERS" ? (
                    <div className="admin-recipient-picker">
                      <input
                        aria-label="Search buyers"
                        placeholder="Search by buyer name or email"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      <div className="admin-recipient-chips">
                        {composer.selectedBuyers.map((b) => (
                          <button
                            type="button"
                            key={b.id}
                            aria-label={`Remove ${b.name}`}
                            onClick={() =>
                              setComposer({
                                ...composer,
                                selectedBuyers: composer.selectedBuyers.filter(
                                  (selected) => selected.id !== b.id,
                                ),
                              })
                            }
                          >
                            {b.name} ×
                          </button>
                        ))}
                      </div>
                      {buyerError ? (
                        <p role="alert" className="text-destructive">
                          {buyerError}
                        </p>
                      ) : buyerLoading ? (
                        <p role="status">Loading buyers…</p>
                      ) : (
                        <div className="admin-recipient-list">
                          {buyers.map((b) => (
                            <label key={b.id}>
                              <input
                                type="checkbox"
                                checked={composer.selectedBuyers.some(
                                  (selected) => selected.id === b.id,
                                )}
                                onChange={(e) =>
                                  setComposer({
                                    ...composer,
                                    selectedBuyers: e.target.checked
                                      ? [...composer.selectedBuyers, b]
                                      : composer.selectedBuyers.filter(
                                          (selected) => selected.id !== b.id,
                                        ),
                                  })
                                }
                              />
                              <span>
                                <strong>{b.name}</strong>
                                <small>{b.email}</small>
                              </span>
                            </label>
                          ))}
                          {!buyers.length && <p>No buyers found. Try another name or email.</p>}
                        </div>
                      )}
                      <small>
                        {composer.selectedBuyers.length} selected. Search to find more buyers.
                      </small>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {buyerLoading
                        ? "Checking recipient count…"
                        : buyerError ||
                          `${buyerTotal} eligible buyer${buyerTotal === 1 ? "" : "s"} currently registered. New accounts created after publication won’t receive this update.`}
                    </p>
                  )}
                </fieldset>
              </>
            )}
            {saveError && (
              <p role="alert" className="admin-form-error">
                {saveError}
              </p>
            )}
            <div className="admin-form-actions">
              {composer.published ? (
                <Button type="button" onClick={() => setComposer(null)}>
                  Close
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || !canSave}
                    onClick={() => void save()}
                  >
                    {busy ? "Saving…" : "Save draft"}
                  </Button>
                  <Button
                    type="button"
                    disabled={busy || !canSave}
                    onClick={() => (preview ? void save(true) : setPreview(true))}
                  >
                    <Send size={16} />
                    {busy ? "Please wait…" : preview ? "Publish announcement" : "Review & publish"}
                  </Button>
                </>
              )}
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
