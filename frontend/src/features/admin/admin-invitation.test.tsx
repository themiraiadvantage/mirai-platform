import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AdminStaffAccess } from "./AdminStaffAccess";
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./admin-auth", async (original) => ({
  ...(await original<typeof import("./admin-auth")>()),
  adminRequest: mocks.request,
  useAdminAccess: () => ({
    user: {
      id: "owner",
      name: "Owner",
      email: "owner@example.com",
      staffRole: "SUPER_ADMIN",
      staffActive: true,
    },
    permissions: ["staff"],
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.request.mockImplementation(async (_path: string, options?: RequestInit) =>
    options?.method === "POST" ? { message: "Invitation sent." } : { members: [], invitations: [] },
  );
});
afterEach(cleanup);
describe("simple admin invitation", () => {
  it("asks only for name and email and submits no role or permissions", async () => {
    render(<AdminStaffAccess />);
    await screen.findByText(/No pending invitations/);
    fireEvent.click(screen.getByRole("button", { name: "Invite admin" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.queryByRole("combobox")).not.toBeInTheDocument();
    expect(dialog.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(dialog.queryByText("Allowed sections")).not.toBeInTheDocument();
    fireEvent.change(dialog.getByLabelText("Full name"), { target: { value: "New Admin" } });
    fireEvent.change(dialog.getByLabelText("Email address"), {
      target: { value: "newadmin@example.com" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Send invitation" }));
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith("/invitations", {
        method: "POST",
        body: JSON.stringify({ name: "New Admin", email: "newadmin@example.com" }),
      }),
    );
    expect(await screen.findByText("Invitation sent.")).toBeInTheDocument();
  });
});
