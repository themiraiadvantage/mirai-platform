import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { ApiError } from "@/lib/api";
import { AdminGate, AdminPageAccess } from "./admin-auth";
import { AdminProvider } from "./admin-store";
import AdminShell from "./AdminShell";

const mocks = vi.hoisted(() => ({
  path: "/admin",
  request: vi.fn(),
  replace: vi.fn(),
  mounts: 0,
  session: { id: "admin-1", name: "Admin", email: "admin@example.com", role: "buyer" } as
    { id: string; name: string; email: string; role: string } | null | undefined,
}));
const router = { replace: mocks.replace };
vi.mock("next/navigation", () => ({ usePathname: () => mocks.path, useRouter: () => router }));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  apiRequest: mocks.request,
}));
vi.mock("@/lib/session", () => ({
  useSession: () => mocks.session,
  getAccessToken: async () => "token",
  signOut: vi.fn(),
}));
const access = {
  user: {
    id: "admin-1",
    name: "Admin",
    email: "admin@example.com",
    staffRole: "ADMIN",
    staffActive: true,
  },
  permissions: ["dashboard", "documents", "settings"],
};
const settings = {
  company: "MIRAI",
  email: "support@example.com",
  phone: "",
  reservationFee: 30000,
  accessMonths: 12,
};
function Frame({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    mocks.mounts++;
  }, []);
  return (
    <>
      <aside data-testid="sidebar">Admin sidebar</aside>
      <main>
        <AdminPageAccess>{children}</AdminPageAccess>
      </main>
    </>
  );
}
function Page() {
  return <p>Content for {mocks.path}</p>;
}
function Harness() {
  return (
    <AdminGate>
      <AdminProvider liveSettings frame={Frame}>
        <Page />
      </AdminProvider>
    </AdminGate>
  );
}
beforeEach(() => {
  localStorage.clear();
  mocks.mounts = 0;
  mocks.path = "/admin";
  mocks.replace.mockReset();
  mocks.session = { id: "admin-1", name: "Admin", email: "admin@example.com", role: "buyer" };
  mocks.request.mockReset();
  mocks.request.mockImplementation(async (path: string) =>
    path.endsWith("/me") ? access : settings,
  );
});
afterEach(cleanup);
describe("persistent admin navigation", () => {
  it("keeps the real admin navigation mounted when the page changes", async () => {
    const view = render(
      <AdminShell>
        <Page />
      </AdminShell>,
    );
    await screen.findByText("Content for /admin");
    expect(screen.queryByText(/Staff access is live/)).not.toBeInTheDocument();
    const navigation = screen.getByRole("navigation", { name: "Admin navigation" });
    mocks.path = "/admin/documents";
    view.rerender(
      <AdminShell>
        <Page />
      </AdminShell>,
    );
    expect(screen.getByText("Content for /admin/documents")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Admin navigation" })).toBe(navigation);
    expect(mocks.request).toHaveBeenCalledTimes(2);
  });
  it("keeps the sidebar and settings mounted across route changes without repeating backend requests", async () => {
    const view = render(<Harness />);
    await screen.findByText("Content for /admin");
    const sidebar = screen.getByTestId("sidebar");
    expect(mocks.request).toHaveBeenCalledTimes(2);
    mocks.path = "/admin/documents";
    view.rerender(<Harness />);
    expect(screen.getByText("Content for /admin/documents")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBe(sidebar);
    expect(mocks.mounts).toBe(1);
    expect(mocks.request).toHaveBeenCalledTimes(2);
    mocks.path = "/admin/settings";
    view.rerender(<Harness />);
    expect(screen.getByText("Content for /admin/settings")).toBeInTheDocument();
    expect(mocks.request).toHaveBeenCalledTimes(2);
  });
  it("shows content loading inside the verified sidebar while settings are pending", async () => {
    let finish!: (value: typeof settings) => void;
    mocks.request.mockImplementation(async (path: string) =>
      path.endsWith("/me")
        ? access
        : new Promise((resolve) => {
            finish = resolve;
          }),
    );
    render(<Harness />);
    await screen.findByTestId("sidebar");
    expect(screen.queryByText("Content for /admin")).not.toBeInTheDocument();
    expect(screen.getByRole("status").closest("main")).not.toBeNull();
    const sidebar = screen.getByTestId("sidebar");
    finish(settings);
    await screen.findByText("Content for /admin");
    expect(screen.getByTestId("sidebar")).toBe(sidebar);
  });
  it("checks permissions for every route without removing the sidebar or rendering forbidden content", async () => {
    const view = render(<Harness />);
    await screen.findByText("Content for /admin");
    const sidebar = screen.getByTestId("sidebar");
    mocks.path = "/admin/staff";
    view.rerender(<Harness />);
    expect(screen.getByRole("alert")).toHaveTextContent("does not have access");
    expect(screen.queryByText("Content for /admin/staff")).not.toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBe(sidebar);
    mocks.path = "/admin/documents";
    view.rerender(<Harness />);
    expect(screen.getByText("Content for /admin/documents")).toBeInTheDocument();
    expect(mocks.request).toHaveBeenCalledTimes(2);
  });
  it("rechecks on focus and removes protected content after admin access is revoked", async () => {
    render(<Harness />);
    await screen.findByText("Content for /admin");
    mocks.request.mockRejectedValueOnce(new ApiError("Admin access suspended", 403));
    fireEvent(window, new Event("focus"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Admin access suspended");
    expect(screen.queryByText("Content for /admin")).not.toBeInTheDocument();
  });
  it("keeps the sidebar during a token/session refresh for the same account", async () => {
    const view = render(<Harness />);
    await screen.findByText("Content for /admin");
    const sidebar = screen.getByTestId("sidebar");
    mocks.request.mockImplementation(() => new Promise(() => {}));
    mocks.session = { ...mocks.session! };
    view.rerender(<Harness />);
    expect(screen.getByTestId("sidebar")).toBe(sidebar);
    expect(screen.getByText("Content for /admin")).toBeInTheDocument();
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(3));
  });
  it("shows only the workspace frame before a session is verified", () => {
    mocks.session = undefined;
    render(<Harness />);
    expect(screen.getByLabelText("Admin navigation loading")).toBeInTheDocument();
    expect(screen.queryByText("Content for /admin")).not.toBeInTheDocument();
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
