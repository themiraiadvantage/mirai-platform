import { ALERTS } from "./data";

export function buyerAlerts(codes: string[], matchingCode?: string) {
  return ALERTS.filter(
    (a) =>
      (a.type === "announcement" && a.scope === "all-buyers") ||
      (a.type === "matching"
        ? Boolean(matchingCode && a.code === matchingCode)
        : codes.includes(a.code)),
  );
}

export function alertHref(alert: (typeof ALERTS)[number]) {
  if (alert.type === "announcement") return "/dashboard/notifications";
  if (alert.type === "matching") return "/dashboard/co-own";
  const tab = { payment: "ledger", document: "documents", verification: "summary", site: "site" }[
    alert.type
  ];
  return `/dashboard/plots/${alert.code}?tab=${tab}`;
}
