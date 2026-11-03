import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminGate, AdminPageAccess, adminDestination } from "./admin-auth";
import { AdminLogin, AdminSetPassword } from "./AdminLogin";
const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn() },
  path: "/admin/documents",
  session: undefined as undefined | null | { id: string },
  api: vi.fn(),
  token: vi.fn().mockResolvedValue("access-token"),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
  usePathname: () => mocks.path,
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiRequest: mocks.api,
}));
vi.mock("@/lib/session", () => ({
  useSession: () => mocks.session,
  getAccessToken: mocks.token,
  signIn: mocks.signIn,
  signOut: mocks.signOut,
}));
const access = {
  user: {
    id: "staff-1",
    name: "Owner",
    email: "owner@example.com",
    staffRole: "SUPER_ADMIN",
    staffActive: true,
  },
  permissions: ["dashboard", "documents", "staff"],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session = undefined;
  mocks.path = "/admin/documents";
  window.history.replaceState(null, "", mocks.path);
});
afterEach(cleanup);
describe("admin authentication", () => {
  it("keeps return paths inside admin and prevents auth loops and external redirects", () => {
    expect(adminDestination("/admin/plots/MR-1?tab=docs")).toBe("/admin/plots/MR-1?tab=docs");
    for (const target of [
      "https://evil.example",
      "//evil.example",
      "/admin/login?redirect=/admin/login",
      "/admin/set-password",
      "/dashboard",
      "/admin\\evil",
    ])
      expect(adminDestination(target)).toBe("/admin");
  });
  it("hides workspace data until real access has been checked", async () => {
    const { rerender } = render(
      <AdminGate>
        <AdminPageAccess>
          <p>Protected data</p>
        </AdminPageAccess>
      </AdminGate>,
    );
    expect(screen.queryByText("Protected data")).not.toBeInTheDocument();
    mocks.session = { id: "staff-1" };
    mocks.api.mockResolvedValue(access);
    rerender(
      <AdminGate>
        <AdminPageAccess>
          <p>Protected data</p>
        </AdminPageAccess>
      </AdminGate>,
    );
    expect(await screen.findByText("Protected data")).toBeInTheDocument();
    expect(mocks.api).toHaveBeenCalledWith(
      "/admin/auth/me",
      expect.objectContaining({ headers: { Authorization: "Bearer access-token" } }),
    );
  });
  it("redirects signed-out visitors with their destination", async () => {
    mocks.session = null;
    render(
      <AdminGate>
        <AdminPageAccess>
          <p>Protected data</p>
        </AdminPageAccess>
      </AdminGate>,
    );
    await waitFor(() =>
      expect(mocks.router.replace).toHaveBeenCalledWith(
        "/admin/login?redirect=%2Fadmin%2Fdocuments",
      ),
    );
    expect(screen.queryByText("Protected data")).not.toBeInTheDocument();
  });
  it("blocks sections outside the server-assigned role", async () => {
    mocks.session = { id: "staff-1" };
    mocks.api.mockResolvedValue({ ...access, permissions: ["dashboard", "plots"] });
    render(
      <AdminGate>
        <AdminPageAccess>
          <p>Protected data</p>
        </AdminPageAccess>
      </AdminGate>,
    );
    expect(
      await screen.findByText("Your role does not have access to this section."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Protected data")).not.toBeInTheDocument();
  });
  it("shows backend denial and keeps buyer sessions out of admin", async () => {
    mocks.session = { id: "buyer-1" };
    mocks.api.mockRejectedValue(new Error("This account does not have active admin access."));
    render(
      <AdminGate>
        <AdminPageAccess>
          <p>Protected data</p>
        </AdminPageAccess>
      </AdminGate>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("active admin access");
    expect(screen.queryByText("Protected data")).not.toBeInTheDocument();
  });
  it("signs in through admin auth and restores the selected admin page", async () => {
    window.history.replaceState(null, "", "/admin/login?redirect=%2Fadmin%2Fplots");
    mocks.signIn.mockResolvedValue({ id: "staff-1" });
    mocks.api.mockResolvedValue(access);
    render(<AdminLogin />);
    fireEvent.change(screen.getByLabelText("Admin email"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "PrivatePassword1!" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(mocks.signIn).toHaveBeenCalledWith("owner@example.com", "PrivatePassword1!", true),
    );
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/admin/plots"));
  });
  it("requires an invitation and never offers a default password", async () => {
    render(<AdminSetPassword />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Open the password setup link");
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    expect(mocks.api).not.toHaveBeenCalled();
  });
  it("checks matching passwords and submits only token and chosen password", async () => {
    const token = "a".repeat(64);
    window.history.replaceState(null, "", `/admin/set-password#token=${token}`);
    mocks.api
      .mockResolvedValueOnce({
        name: "Invited Admin",
        email: "invited@example.com",
        role: "LISTING_MANAGER",
      })
      .mockResolvedValueOnce({ message: "Password set" });
    render(<AdminSetPassword />);
    await screen.findByText("invited@example.com");
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "MyPrivatePassword1!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "Different1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set password and activate account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("do not match");
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "MyPrivatePassword1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set password and activate account" }));
    await screen.findByText("Your account is ready.");
    expect(mocks.api).toHaveBeenLastCalledWith(
      "/auth/admin/accept-invitation",
      expect.objectContaining({ body: JSON.stringify({ token, password: "MyPrivatePassword1!" }) }),
    );
    expect(window.location.hash).toBe("");
  });
});
