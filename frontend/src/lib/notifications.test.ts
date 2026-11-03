import { describe, expect, it } from "vitest";
import { ALERTS } from "./data";
import { alertHref, buyerAlerts } from "./notifications";

describe("buyer notification routing", () => {
  it("shows only the buyer's plot alerts and explicitly public announcements", () => {
    const announcement = {
      id: 901,
      type: "announcement" as const,
      scope: "all-buyers" as const,
      code: "",
      title: "Test",
      body: "Test",
      time: "Now",
      unread: true,
    };
    const matching = {
      ...announcement,
      id: 902,
      type: "matching" as const,
      scope: undefined,
      code: "MR-4105",
    };
    ALERTS.push(announcement, matching);
    try {
      const list = buyerAlerts(["MR-4092"]);
      expect(list.every((a) => a.code === "MR-4092" || a.id === 901)).toBe(true);
      expect(list).toContain(announcement);
      expect(list).not.toContain(matching);
      expect(buyerAlerts([], "MR-4105")).toContain(matching);
      expect(alertHref(announcement)).toBe("/dashboard/notifications");
      expect(alertHref(matching)).toBe("/dashboard/co-own");
    } finally {
      ALERTS.splice(-2);
    }
  });
  it("opens the relevant payment or document tab", () => {
    expect(alertHref({ ...ALERTS[0], type: "document" })).toBe(
      "/dashboard/plots/MR-4092?tab=documents",
    );
    expect(alertHref(ALERTS[0])).toBe("/dashboard/plots/MR-4092?tab=ledger");
  });
});
