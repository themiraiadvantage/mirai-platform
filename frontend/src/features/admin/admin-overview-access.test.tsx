import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AdminWorkspace from "./AdminWorkspace";
import { AdminProvider } from "./admin-store";
const mocks = vi.hoisted(() => ({ permissions: ["dashboard"] }));
vi.mock("@/lib/property-api", async (original) => ({
  ...(await original<typeof import("@/lib/property-api")>()),
  usePropertyResource: (_path: string, _auth: boolean, enabled: boolean) => ({
    data: enabled
      ? {
          items: [],
          total: 0,
          stats: { total: 0, published: 0, drafts: 0, active: 0, confirmed: 30000, pending: 0 },
        }
      : null,
    loading: false,
    error: "",
    refresh: vi.fn(),
  }),
}));
vi.mock("./admin-auth", async (original) => ({
  ...(await original<typeof import("./admin-auth")>()),
  useAdminAccess: () => ({
    user: {
      id: "staff",
      name: "Admin",
      email: "staff@example.com",
      staffRole: "LISTING_MANAGER",
      staffActive: true,
    },
    permissions: mocks.permissions,
  }),
}));
beforeEach(() => {
  localStorage.clear();
});
afterEach(cleanup);
describe("overview follows assigned permissions", () => {
  it("shows the document library without exposing payment or plot summaries", async () => {
    mocks.permissions = ["dashboard", "documents"];
    render(
      <AdminProvider>
        <AdminWorkspace />
      </AdminProvider>,
    );
    await screen.findByText("Documents");
    expect(screen.queryByText("Collections overview")).not.toBeInTheDocument();
    expect(screen.queryByText("Your plot portfolio")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent activity")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add a plot" })).not.toBeInTheDocument();
    for (const link of screen.getAllByRole("link"))
      expect(link.getAttribute("href")).toBe("/admin/documents");
  });
  it("shows collections for payments access without unrelated records", async () => {
    mocks.permissions = ["dashboard", "payments"];
    render(
      <AdminProvider>
        <AdminWorkspace />
      </AdminProvider>,
    );
    await screen.findByText("Collections overview");
    expect(screen.getAllByText("₦30,000").length).toBeGreaterThan(0);
    expect(screen.queryByText("Documents")).not.toBeInTheDocument();
    expect(screen.queryByText("Your plot portfolio")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent activity")).not.toBeInTheDocument();
  });
  it("provides an overview-only state with no operational records", async () => {
    mocks.permissions = ["dashboard"];
    render(
      <AdminProvider>
        <AdminWorkspace />
      </AdminProvider>,
    );
    await screen.findByText(/You currently have Overview access/);
    expect(screen.queryByText("Collections overview")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
