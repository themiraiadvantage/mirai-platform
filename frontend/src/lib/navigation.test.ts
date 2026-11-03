import { describe, expect, it } from "vitest";
import { authHref, workspaceDestination } from "./navigation";

describe("authenticated purchase destinations", () => {
  it("returns public plot and co-ownership journeys to their workspace pages", () => {
    expect(workspaceDestination("/plots/MR-4092?plan=3mo#plans")).toBe(
      "/dashboard/explore/MR-4092?plan=3mo#plans",
    );
    expect(workspaceDestination("/plots")).toBe("/dashboard/explore");
    expect(workspaceDestination("/co-own")).toBe("/dashboard/co-own/start");
    expect(workspaceDestination("/dashboard/plots/MR-4092?tab=documents")).toBe(
      "/dashboard/plots/MR-4092?tab=documents",
    );
  });
  it("rejects external destinations and auth loops", () => {
    for (const value of [
      "https://example.com",
      "//example.com",
      "/\\example.com",
      "/sign-in",
      "/verify-email?redirect=/sign-in",
      null,
    ]) {
      expect(workspaceDestination(value)).toBe("/dashboard");
    }
    expect(authHref("/sign-in", "/dashboard")).toBe("/sign-in");
  });
});
