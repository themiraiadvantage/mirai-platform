import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ReservationCheckout } from "@/features/plots/ReservationCheckout";
import { PaymentReturn } from "@/features/dashboard/PaymentReturn";
import { ReservationRecords } from "@/features/dashboard/ReservationRecords";
import { LiveAdminReservations } from "@/features/admin/LiveAdminReservations";
import type { LivePlot } from "@/lib/property-api";
import { reservationDate, type Reservation, type ReservationPage } from "@/lib/reservation-api";
const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  refresh: vi.fn(),
  resourceRefresh: vi.fn(),
  download: vi.fn(),
  session: null as { id: string; staffRole?: string } | null,
  page: null as ReservationPage | null,
}));
vi.mock("@/lib/session", () => ({ useSession: () => mocks.session }));
vi.mock("@/lib/property-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/property-api")>()),
  post: (...args: unknown[]) => mocks.post(...args),
  usePropertyResource: () => ({
    data: mocks.page,
    loading: false,
    error: "",
    refresh: mocks.resourceRefresh,
  }),
}));
vi.mock("@/components/mirai/BuyerNotifications", () => ({
  useBuyerNotifications: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/lib/demo-store", () => ({
  downloadText: (...args: unknown[]) => mocks.download(...args),
}));
const plot: LivePlot = {
  id: "plot-id",
  code: "TEST-001",
  title: "600 sqm Epe plot",
  description: "A plot",
  location: "Epe",
  lga: "Epe",
  state: "Lagos",
  size: 600,
  price: "6000000",
  legalFee: "100000",
  surveyFee: "200000",
  documentationFee: "100000",
  reservationFee: "30000",
  accessMonths: 12,
  publication: "Published",
  availability: "Available",
  verification: "unchecked",
  coEnabled: false,
  coMonths: 3,
  coDepositPercent: 10,
  version: 4,
  updatedAt: "2026-11-02T10:00:00Z",
  assets: [],
  details: { plans: ["Outright"], latitude: 6.5, longitude: 3.5, siteStatus: "", docSummary: "" },
};
const row: Reservation = {
  id: "reservation-id",
  status: "ACTIVE",
  amount: 30000,
  accessMonths: 12,
  termsVersion: "reservation-test-v1",
  acceptedAt: "2026-11-02T10:00:00Z",
  checkoutExpiresAt: "2026-11-02T10:20:00Z",
  accessExpiresAt: "2027-11-02T10:00:00Z",
  reviewReason: null,
  createdAt: "2026-11-02T10:00:00Z",
  snapshot: {
    price: "6000000",
    legalFee: "100000",
    surveyFee: "200000",
    documentationFee: "100000",
  },
  plot,
  payment: {
    reference: "MIRAI-" + "a".repeat(32),
    amount: 30000,
    status: "SUCCESS",
    mode: "test",
    paidAt: "2026-11-02T10:00:00Z",
    authorizationUrl: null,
  },
};
beforeEach(() => {
  mocks.session = { id: "buyer" };
  mocks.page = null;
  mocks.post.mockReset();
  mocks.refresh.mockReset().mockResolvedValue(undefined);
  mocks.download.mockReset();
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});
describe("Paystack reservation screens", () => {
  it("keeps admin payment rows compact and hides references and test labels", () => {
    mocks.page = {
      items: [{ ...row, buyer: { id: "buyer", name: "Paul Buyer", email: "paul@example.com" } }],
      total: 1,
      nextCursor: null,
      stats: { active: 1, confirmed: 30000, mode: "test" },
      termsVersion: "reservation-test-v1",
    };
    render(<LiveAdminReservations payments />);
    expect(screen.queryByText(row.payment!.reference)).not.toBeInTheDocument();
    expect(screen.queryByText(/test mode|test money|test payment/i)).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Date" })).toBeInTheDocument();
    expect(screen.queryByText("Access until")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    const details = within(screen.getByRole("dialog"));
    expect(details.getByText("Access until")).toBeInTheDocument();
    expect(details.queryByText(row.payment!.reference)).not.toBeInTheDocument();
    expect(details.queryByRole("button", { name: "Check payment" })).not.toBeInTheDocument();
  });
  it("verifies pending admin payments from details using the hidden reference", async () => {
    const pending: Reservation = {
      ...row,
      status: "PENDING",
      payment: { ...row.payment!, status: "PENDING", paidAt: null },
    };
    mocks.page = {
      items: [pending],
      total: 1,
      nextCursor: null,
      stats: { active: 0, confirmed: 0, mode: "test" },
      termsVersion: "reservation-test-v1",
    };
    mocks.post.mockResolvedValue(row);
    render(<LiveAdminReservations payments />);
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Check payment" }),
    );
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith("/admin/payments/verify", {
        reference: row.payment!.reference,
      }),
    );
    expect(await within(screen.getByRole("dialog")).findByText("Confirmed")).toBeInTheDocument();
  });
  it("preserves the selected plot when a visitor signs in", () => {
    mocks.session = null;
    render(<ReservationCheckout plot={plot} />);
    expect(screen.getByRole("link", { name: /Sign in to reserve/ })).toHaveAttribute(
      "href",
      "/sign-in?redirect=%2Fdashboard%2Fexplore%2FTEST-001",
    );
  });
  it("requires acceptance and sends the plot version without a client-priced amount", async () => {
    mocks.post.mockRejectedValue(new Error("Paystack is temporarily unavailable."));
    render(<ReservationCheckout plot={plot} />);
    fireEvent.click(screen.getByRole("button", { name: /Reserve this plot/ }));
    const pay = screen.getByRole("button", { name: /Continue to Paystack/ });
    expect(pay).toBeDisabled();
    expect(screen.getByText(/It is not deducted from the land price/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(pay);
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith("/reservations/checkout", {
        plotId: "plot-id",
        version: 4,
        termsVersion: "reservation-test-v1",
        accepted: true,
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Paystack is temporarily unavailable.",
    );
    expect(pay).not.toBeDisabled();
  });
  it("does not offer checkout for an unavailable plot or staff account", () => {
    const view = render(<ReservationCheckout plot={{ ...plot, availability: "Reserved" }} />);
    expect(screen.queryByRole("button", { name: /Reserve this plot/ })).not.toBeInTheDocument();
    view.unmount();
    mocks.session = { id: "admin", staffRole: "Admin" };
    render(<ReservationCheckout plot={plot} />);
    expect(screen.getByText(/Use a customer account/)).toBeInTheDocument();
  });
  it("verifies the callback reference before showing confirmation", async () => {
    window.history.replaceState(
      null,
      "",
      "/dashboard/payments/return?reference=" + row.payment!.reference,
    );
    mocks.post.mockResolvedValue(row);
    render(<PaymentReturn />);
    expect(
      await screen.findByRole("heading", { name: "Your reservation is confirmed" }),
    ).toBeInTheDocument();
    expect(mocks.post).toHaveBeenCalledWith("/reservations/verify", {
      reference: row.payment!.reference,
    });
    expect(screen.getByRole("link", { name: "Open Land Library" })).toHaveAttribute(
      "href",
      "/dashboard/library",
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });
  it("does not trust success in the browser query string", async () => {
    window.history.replaceState(
      null,
      "",
      "/dashboard/payments/return?status=success&reference=" + row.payment!.reference,
    );
    mocks.post.mockResolvedValue({
      ...row,
      status: "PENDING",
      payment: { ...row.payment!, status: "PENDING" },
    });
    render(<PaymentReturn />);
    expect(
      await screen.findByRole("heading", { name: "Your reservation is not confirmed yet" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open Land Library" })).not.toBeInTheDocument();
  });
  it("shows a confirmed receipt separately from ownership", () => {
    mocks.page = {
      items: [row],
      total: 1,
      nextCursor: null,
      stats: { active: 1, confirmed: 30000, mode: "test" },
      termsVersion: "reservation-test-v1",
    };
    render(<ReservationRecords payments />);
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.queryByText(row.payment!.reference)).not.toBeInTheDocument();
    expect(screen.getByText("Payment received")).toBeInTheDocument();
    expect(screen.getByText("Access valid until")).toBeInTheDocument();
    expect(screen.getAllByText("11:00 AM WAT")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /Download receipt/ }));
    expect(mocks.download).toHaveBeenCalledWith(
      row.payment!.reference + ".txt",
      expect.stringContaining("not proof of land ownership"),
    );
    expect(screen.queryByRole("button", { name: /Check payment status/ })).not.toBeInTheDocument();
  });
  it("formats morning and afternoon times in Lagos with AM and PM", () => {
    expect(reservationDate("2026-11-02T01:07:00Z")).toBe("2 Nov 2026, 2:07 AM");
    expect(reservationDate("2026-11-02T13:07:00Z")).toBe("2 Nov 2026, 2:07 PM");
  });
});
