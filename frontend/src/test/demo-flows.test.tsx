import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, cleanup } from "@testing-library/react";
import { safeRedirect } from "@/lib/navigation";
import { PLOTS, PERMISSIONS } from "@/lib/data";

beforeEach(() => {
  cleanup();
  localStorage.clear();
  vi.resetModules();
});
function login(email: string) {
  localStorage.setItem(
    "mirai-session",
    JSON.stringify({ name: "Demo buyer", email, role: "buyer", lastLogin: "20 Oct 2026" }),
  );
}
describe("buyer journey", () => {
  it("records reservation access dates and never treats final payment as legal completion", async () => {
    login("new@demo.mirai.ng");
    const store = await import("@/lib/demo-store");
    const { result } = renderHook(() => store.useDemo());
    act(() => {
      store.reservePlot("MR-4092", "Outright", "Card");
    });
    const reservation = result.current!.owned[0];
    expect(reservation.reservedAt).toBeDefined();
    expect(new Date(reservation.accessExpiresAt!).getFullYear()).toBe(
      new Date(reservation.reservedAt!).getFullYear() + 1,
    );
    act(() => {
      store.recordPayment("MR-4092", reservation.instalments[0].amount, "Card", "Instalment", 0);
    });
    expect(result.current!.owned[0].stage).toBe("Payment");
    expect(result.current!.owned[0].paid).toBe(reservation.instalments[0].amount);
  });
  it("starts new buyers with an empty library and keeps prepared accounts separate", async () => {
    const store = await import("@/lib/demo-store");
    login("new@demo.mirai.ng");
    const a = renderHook(() => store.useDemo());
    expect(a.result.current?.owned).toHaveLength(0);
    a.unmount();
    login("tunde@demo.mirai.ng");
    const b = renderHook(() => store.useDemo());
    expect(b.result.current?.owned).toHaveLength(1);
    b.unmount();
    login("amaka@demo.mirai.ng");
    const c = renderHook(() => store.useDemo());
    expect(c.result.current?.owned).toHaveLength(3);
  });
  it("reserves once, records the access fee separately, and creates the selected schedule", async () => {
    login("new@demo.mirai.ng");
    const store = await import("@/lib/demo-store");
    const { result } = renderHook(() => store.useDemo());
    act(() => {
      store.reservePlot("MR-4092", "6mo", "Bank transfer");
      store.reservePlot("MR-4092", "6mo", "Bank transfer");
    });
    expect(result.current?.owned).toHaveLength(1);
    expect(result.current?.receipts).toHaveLength(1);
    expect(result.current?.receipts[0].amount).toBe(30000);
    const owned = result.current!.owned[0];
    expect(owned.paid).toBe(0);
    expect(owned.plan).toBe("6mo");
    expect(owned.instalments).toHaveLength(6);
    expect(owned.instalments.reduce((a, i) => a + i.amount, 0)).toBe(7140000);
  });
  it("updates an overdue payment once and preserves the other buyer’s balance", async () => {
    login("tunde@demo.mirai.ng");
    const store = await import("@/lib/demo-store");
    const a = renderHook(() => store.useDemo());
    act(() => {
      store.recordPayment("MR-4092", 1190000, "Card", "Instalment", 3);
      store.recordPayment("MR-4092", 1190000, "Card", "Instalment", 3);
    });
    expect(a.result.current?.owned[0].paid).toBe(4760000);
    expect(a.result.current?.owned[0].instalments[3].status).toBe("Paid");
    expect(a.result.current?.receipts).toHaveLength(1);
    a.unmount();
    login("amaka@demo.mirai.ng");
    const b = renderHook(() => store.useDemo());
    expect(b.result.current?.owned[0].paid).toBe(3570000);
    b.unmount();
    login("tunde@demo.mirai.ng");
    const c = renderHook(() => store.useDemo());
    expect(c.result.current?.owned[0].paid).toBe(4760000);
  });
  it("rejects invalid payment amounts without creating records", async () => {
    login("new@demo.mirai.ng");
    const store = await import("@/lib/demo-store");
    expect(() => store.recordPayment("MR-4092", -1, "Card", "Instalment")).toThrow();
    expect(() => store.recordPayment("MR-4092", NaN, "Card", "Instalment")).toThrow();
  });
});
describe("trust and access boundaries", () => {
  it("preserves internal return paths and rejects external redirect tricks", () => {
    expect(safeRedirect("/plots/MR-4092?reserve=1")).toBe("/plots/MR-4092?reserve=1");
    for (const url of [
      null,
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/\n/evil.example",
    ])
      expect(safeRedirect(url)).toBe("/dashboard");
  });
  it("does not invent findings for plots that have not been checked", () => {
    const unchecked = PLOTS.filter((p) => p.siteStatus === "Not yet checked");
    expect(unchecked.length).toBeGreaterThan(0);
    expect(unchecked.every((p) => p.checks.every((c) => c.result === "nodata"))).toBe(true);
  });
  it("limits each staff role to its workspace", () => {
    expect(PERMISSIONS["Listing Manager"]).not.toContain("payments");
    expect(PERMISSIONS["Payment Support"]).not.toContain("staff");
    expect(PERMISSIONS["Document Administrator"]).toContain("documents");
    expect(PERMISSIONS["Site Check Contributor"]).not.toContain("verification");
  });
});
