"use client";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { authenticatedRequest, announcementDate } from "@/lib/announcement-api";
import type { ActivityPage } from "@/lib/activity";

export function AdminRecentActivity() {
  const [items, setItems] = useState<ActivityPage["items"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    authenticatedRequest<ActivityPage>("/admin/activity")
      .then((page) => {
        if (active) setItems(page.items.slice(0, 5));
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Could not load recent activity.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="admin-activity-feed">
      {loading ? (
        <p role="status">Loading recent activity…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : !items.length ? (
        <p>No recorded activity yet.</p>
      ) : (
        items.map((item) => (
          <div key={item.id}>
            <span>
              <CheckCircle2 size={15} />
            </span>
            <div>
              <strong>{item.action}</strong>
              <p>
                {item.targetLabel} · {item.actorName}
              </p>
              <small>{announcementDate(item.createdAt)}</small>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
