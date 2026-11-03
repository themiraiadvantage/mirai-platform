import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LiveAdminBuyers } from "@/features/admin/LiveAdminBuyers";
import { BuyerPersonalDetails } from "@/features/dashboard/BuyerPersonalDetails";
import type { BuyerDetail } from "@/lib/buyer-api";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  update: vi.fn(),
  restricted: false,
  fail: false,
}));
vi.mock("@/lib/session", () => ({
  useSession: () => ({ id: "actor", name: "Paul Buyer", role: "buyer" }),
  updateSession: (...args: unknown[]) => mocks.update(...args),
}));
vi.mock("@/lib/announcement-api", () => ({
  authenticatedRequest: (...args: unknown[]) => mocks.auth(...args),
}));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
const buyer: BuyerDetail = {
  id: "buyer-1",
  name: "Paul Buyer",
  email: "paul@example.com",
  verified: true,
  joinedAt: "2026-11-02T10:00:00Z",
  phone: "08012345678",
  location: "Lagos",
  version: 2,
  notes: "Private staff note",
  activeReservations: 1,
  partnerships: 1,
  allocations: 0,
  confirmedFees: 30000,
  confirmedContributions: 1000000,
  documents: 1,
  access: { payments: true, documents: true, reservations: true, coOwnership: true, plots: true },
};
beforeEach(() => {
  mocks.restricted = false;
  mocks.fail = false;
  mocks.success.mockReset();
  mocks.update.mockReset();
  mocks.auth.mockReset().mockImplementation(async (path: string, options?: RequestInit) => {
    if (options?.method === "POST") {
      if (mocks.fail) throw new Error("This profile changed. Reload it before saving.");
      return { ...buyer, notes: undefined, ...JSON.parse(String(options.body)), version: 3 };
    }
    if (path === "/profile") return { ...buyer, notes: undefined };
    const access = mocks.restricted
      ? { payments: false, documents: false, reservations: false, coOwnership: false, plots: false }
      : buyer.access;
    if (path === "/admin/buyers/buyer-1") return { ...buyer, access };
    if (path.startsWith("/admin/buyers/buyer-1/records"))
      return {
        items: [
          {
            id: "record-1",
            plot: {
              code: "MR-001",
              title: "Epe reserved plot",
              location: "Epe",
              state: "Lagos",
              size: 600,
            },
            status: "ACTIVE",
            date: "2026-11-02T10:00:00Z",
            amount: 30000,
          },
        ],
        total: 1,
        nextCursor: null,
      };
    return {
      items: [{ ...buyer, confirmed: mocks.restricted ? null : 1030000 }],
      total: 1,
      nextCursor: null,
      stats: { registered: 1, verified: 1, reserved: 1, allocated: 0 },
      access,
    };
  });
});
afterEach(cleanup);
describe("connected buyers and ownership", () => {
  it("lists real accounts without a sample-account creation action", async () => {
    render(<LiveAdminBuyers />);
    expect(await screen.findByText("Paul Buyer")).toBeInTheDocument();
    expect(screen.getByText("₦1,030,000")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add buyer record" })).not.toBeInTheDocument();
  });
  it("opens saved ownership records for the selected customer", async () => {
    render(<LiveAdminBuyers />);
    await screen.findByText("Paul Buyer");
    fireEvent.click(screen.getByRole("button", { name: /View buyer/ }));
    const dialog = within(screen.getByRole("dialog"));
    expect(await dialog.findByText("Private staff note")).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Reservations" }));
    expect(await dialog.findByText("Epe reserved plot")).toBeInTheDocument();
    expect(mocks.auth).toHaveBeenCalledWith("/admin/buyers/buyer-1/records?section=reservations");
  });
  it("saves contact details and staff notes with concurrency protection", async () => {
    render(<LiveAdminBuyers />);
    await screen.findByText("Paul Buyer");
    fireEvent.click(screen.getByRole("button", { name: /View buyer/ }));
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.click(await dialog.findByRole("button", { name: "Edit details" }));
    fireEvent.change(dialog.getByLabelText("Buyer phone"), { target: { value: "08099999999" } });
    fireEvent.change(dialog.getByLabelText("Staff notes"), {
      target: { value: "Contacted buyer" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Save details" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Buyer details saved"));
    const call = mocks.auth.mock.calls.find(
      ([path, options]) => path === "/admin/buyers/buyer-1" && options?.method === "POST",
    );
    expect(JSON.parse(call![1].body)).toEqual({
      name: "Paul Buyer",
      phone: "08099999999",
      location: "Lagos",
      notes: "Contacted buyer",
      version: 2,
    });
  });
  it("hides financial and document sections from restricted staff", async () => {
    mocks.restricted = true;
    render(<LiveAdminBuyers />);
    await screen.findByText("Paul Buyer");
    expect(
      screen.queryByRole("columnheader", { name: "Confirmed payments" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /View buyer/ }));
    const dialog = within(screen.getByRole("dialog"));
    await dialog.findByText("Private staff note");
    expect(dialog.queryByRole("button", { name: "Reservation fees" })).not.toBeInTheDocument();
    expect(dialog.queryByRole("button", { name: "Documents" })).not.toBeInTheDocument();
  });
  it("saves the buyer's personal details to the same backend profile without staff notes", async () => {
    render(<BuyerPersonalDetails />);
    const location = await screen.findByLabelText("Location");
    fireEvent.change(location, { target: { value: "Ogun" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Profile updated"));
    const call = mocks.auth.mock.calls.find(
      ([path, options]) => path === "/profile" && options?.method === "POST",
    );
    expect(JSON.parse(call![1].body)).toEqual({
      name: "Paul Buyer",
      phone: "08012345678",
      location: "Ogun",
      version: 2,
    });
    expect(screen.queryByText("Private staff note")).not.toBeInTheDocument();
    expect(mocks.update).toHaveBeenCalledWith({
      name: "Paul Buyer",
      phone: "08012345678",
      role: "buyer",
    });
  });
});
