export type ActivityEvent = {
  id: string;
  category: string;
  action: string;
  actorName: string;
  actorRole: string;
  targetLabel: string;
  detail: string;
  createdAt: string;
  changes: Record<string, { before: unknown; after: unknown }> | null;
};
export type ActivityPage = { items: ActivityEvent[]; total: number; nextCursor: string | null };
export const activityCategories: Record<string, string> = {
  AUTH: "Sign-in & sessions",
  STAFF: "Staff & access",
  SETTINGS: "Workspace settings",
  ANNOUNCEMENTS: "Announcements",
  PLOTS: "Plots & listing files",
  CO_OWNERSHIP: "Co-ownership",
  PAYMENTS: "Payments & reservations",
  DOCUMENTS: "Documents",
  BUYERS: "Buyers & ownership",
};

export function activityCsv(items: ActivityEvent[]) {
  const rows = [
    ["Date (UTC)", "Team member", "Role", "Category", "Action", "Record", "Details"],
    ...items.map((item) => [
      item.createdAt,
      item.actorName,
      item.actorRole,
      activityCategories[item.category] ?? item.category,
      item.action,
      item.targetLabel,
      item.detail,
    ]),
  ];
  return rows
    .map((row) =>
      row
        .map((value) => {
          const safe = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
          return `"${safe.replaceAll('"', '""')}"`;
        })
        .join(","),
    )
    .join("\r\n");
}
