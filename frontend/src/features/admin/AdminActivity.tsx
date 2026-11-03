"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, History, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authenticatedRequest, announcementDate } from "@/lib/announcement-api";
import {
  activityCategories,
  activityCsv,
  type ActivityEvent,
  type ActivityPage,
} from "@/lib/activity";
import { downloadText } from "@/lib/demo-store";
import { STAFF_ROLES } from "./admin-auth";
import { Empty, Modal, PageHead, Panel, SearchBox } from "./admin-ui";

const changeLabels: Record<string, string> = {
  company: "Company name",
  email: "Support email",
  phone: "Support phone",
  reservationFee: "Default reservation fee (₦)",
  accessMonths: "Default access (months)",
  role: "Role",
  permissions: "Section permissions",
  active: "Admin access",
};
const valueLabel = (value: unknown) =>
  value == null
    ? "Not set"
    : typeof value === "boolean"
      ? value
        ? "Enabled"
        : "Disabled"
      : Array.isArray(value)
        ? value.length
          ? value.join(", ")
          : "None"
        : String(value);
const roleLabel = (role: string) =>
  role === "SYSTEM" ? "System" : (STAFF_ROLES[role as keyof typeof STAFF_ROLES] ?? role);

export function AdminActivity() {
  const [page, setPage] = useState<ActivityPage>({ items: [], total: 0, nextCursor: null });
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ActivityEvent | null>(null);
  const version = useRef(0);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const load = useCallback(
    async (cursor?: string) => {
      const request = ++version.current;
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (category) params.set("category", category);
        if (from) params.set("from", new Date(`${from}T00:00:00+01:00`).toISOString());
        if (to) params.set("to", new Date(`${to}T23:59:59.999+01:00`).toISOString());
        if (cursor) params.set("cursor", cursor);
        const response = await authenticatedRequest<ActivityPage>(
          `/admin/activity${params.size ? `?${params}` : ""}`,
        );
        if (request !== version.current) return;
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
        if (request === version.current)
          setError(e instanceof Error ? e.message : "Could not load activity history.");
      } finally {
        if (request === version.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [query, category, from, to],
  );
  useEffect(() => {
    void load();
    return () => {
      version.current++;
    };
  }, [load]);
  return (
    <>
      <PageHead
        title="Activity history"
        description="A reliable record of admin actions, recorded when changes are saved."
        action={
          <>
            <Button variant="outline" disabled={loading} onClick={() => void load()}>
              <RefreshCw size={16} />
              Refresh
            </Button>
            <Button
              variant="outline"
              disabled={!page.items.length || loading}
              onClick={() =>
                downloadText(
                  "mirai-activity.csv",
                  activityCsv(page.items),
                  "text/csv;charset=utf-8",
                )
              }
            >
              <Download size={16} />
              Export shown events
            </Button>
          </>
        }
      />
      <div className="admin-activity-filters">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Search activity, team member or record…"
        />
        <label>
          <span>Activity type</span>
          <select
            aria-label="Activity type"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All activity</option>
            {Object.entries(activityCategories).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>From</span>
          <input
            type="date"
            aria-label="From date"
            max={to || undefined}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="date"
            aria-label="To date"
            min={from || undefined}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <div className="admin-activity-caption">
        <span>
          {loading
            ? "Loading activity…"
            : `${page.items.length} shown · ${page.total} matching events`}
        </span>
        <span>
          <History size={14} />
          Times shown in Lagos time
        </span>
      </div>
      {error && (
        <div className="admin-callout mb-5" role="alert">
          <p>{error}</p>
          <Button variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}
      <Panel>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date & time</th>
                <th>Team member</th>
                <th>Activity</th>
                <th>Record</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>
                    <p role="status" className="py-8 text-center text-muted-foreground">
                      Loading recorded events…
                    </p>
                  </td>
                </tr>
              ) : (
                page.items.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap">{announcementDate(item.createdAt)}</td>
                    <td>
                      <strong>{item.actorName}</strong>
                      <small>{roleLabel(item.actorRole)}</small>
                    </td>
                    <td>
                      <strong>{item.action}</strong>
                      <small>{activityCategories[item.category]}</small>
                    </td>
                    <td className="admin-activity-target">{item.targetLabel}</td>
                    <td className="admin-audit-detail">
                      <p>{item.detail}</p>
                      <button className="admin-text-link mt-2" onClick={() => setSelected(item)}>
                        View details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && !page.items.length && !error && (
          <Empty
            title={
              query || category || from || to
                ? "No activity matches these filters"
                : "No recorded activity yet"
            }
            description={
              query || category || from || to
                ? "Try another search or date range."
                : "New admin actions will appear here as your team uses MIRAI."
            }
          />
        )}
      </Panel>
      {page.nextCursor && !loading && (
        <div className="mt-6 text-center">
          <Button
            variant="outline"
            disabled={loadingMore}
            onClick={() => void load(page.nextCursor!)}
          >
            {loadingMore ? "Loading…" : "Load older events"}
          </Button>
        </div>
      )}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.action ?? "Activity details"}
        description={
          selected
            ? `${selected.actorName} · ${announcementDate(selected.createdAt)}`
            : "Recorded activity"
        }
        wide
      >
        {selected && (
          <div className="admin-form">
            <dl className="admin-activity-metadata">
              <div>
                <dt>Team member</dt>
                <dd>
                  {selected.actorName} · {roleLabel(selected.actorRole)}
                </dd>
              </div>
              <div>
                <dt>Record</dt>
                <dd>{selected.targetLabel}</dd>
              </div>
              <div>
                <dt>Details</dt>
                <dd>{selected.detail}</dd>
              </div>
            </dl>
            {selected.changes && Object.keys(selected.changes).length > 0 && (
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Before</th>
                      <th>After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(selected.changes).map(([key, change]) => (
                      <tr key={key}>
                        <td>{changeLabels[key] ?? key}</td>
                        <td className="admin-audit-detail">{valueLabel(change.before)}</td>
                        <td className="admin-audit-detail">{valueLabel(change.after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="admin-form-actions">
              <Button variant="outline" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
