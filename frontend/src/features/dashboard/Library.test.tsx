import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Library from "./Library";
import type { Reservation } from "@/lib/reservation-api";
const state = vi.hoisted(() => ({
  owned: [] as { code: string; stage: string; paid: number }[],
  saved: [] as string[],
  reservation: null as Reservation | null,
}));
vi.mock("@/lib/demo-store", () => ({ useDemo: () => state, downloadText: vi.fn() }));
vi.mock("@/lib/property-api", async (original) => ({
  ...(await original<typeof import("@/lib/property-api")>()),
  usePropertyResource: (path: string) => ({
    data: path.startsWith("/reservations")
      ? {
          items: state.reservation ? [state.reservation] : [],
          total: state.reservation ? 1 : 0,
          stats: { active: state.reservation ? 1 : 0 },
        }
      : path === "/co-ownership/summary"
        ? { active: 0, allocated: 0 }
        : { items: [] },
    loading: false,
    error: "",
    refresh: vi.fn(),
  }),
}));
afterEach(() => {
  cleanup();
  state.owned = [];
  state.saved = [];
  state.reservation = null;
});

describe("Land Library guidance", () => {
  function reservedPlot() {
    state.reservation = {
      id: "reserved-1",
      status: "ACTIVE",
      amount: 30000,
      accessMonths: 12,
      termsVersion: "test",
      acceptedAt: "2026-11-02T10:00:00Z",
      createdAt: "2026-11-02T10:00:00Z",
      checkoutExpiresAt: "2026-11-02T10:20:00Z",
      accessExpiresAt: "2027-11-02T10:00:00Z",
      reviewReason: null,
      snapshot: {
        price: "6000000",
        legalFee: "100000",
        surveyFee: "200000",
        documentationFee: "100000",
      },
      plot: {
        id: "plot-1",
        code: "TEST-001",
        title: "Reserved Epe plot",
        location: "Epe",
        state: "Lagos",
        size: 600,
      },
      payment: null,
    };
  }
  it("directs a first-time buyer to workspace discovery", () => {
    render(<Library />);
    expect(screen.getByText("You haven’t reserved any plots yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore plots" })).toHaveAttribute(
      "href",
      "/dashboard/explore",
    );
  });
  it("distinguishes empty search results and lets buyers clear their filters", () => {
    state.owned = [{ code: "MR-4092", stage: "Reservation", paid: 0 }];
    render(<Library />);
    fireEvent.change(screen.getByLabelText("Search library"), { target: { value: "missing" } });
    expect(screen.getByText("No plots match these filters.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("link", { name: /Open record/ })).toHaveAttribute(
      "href",
      "/dashboard/plots/MR-4092",
    );
  });
  it("shows the account shortlist instead of browser-only sample saves", () => {
    state.saved = ["MR-4092"];
    render(<Library />);
    fireEvent.click(screen.getByRole("button", { name: /Saved plots/ }));
    expect(screen.queryByRole("link", { name: /Open record/ })).not.toBeInTheDocument();
    expect(screen.getByText("Save the plots you want to come back to.")).toBeInTheDocument();
  });
  it("places tabs and filters above reservations and hides reservations on the saved tab", () => {
    reservedPlot();
    render(<Library />);
    const heading = screen.getByRole("heading", { name: "Reserved Epe plot" });
    expect(
      screen.getByRole("button", { name: /Owned & reserved/ }).compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Search library").compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Saved plots/ }));
    expect(screen.queryByRole("heading", { name: "Reserved Epe plot" })).not.toBeInTheDocument();
  });
  it("applies library filters to backend reservations", () => {
    reservedPlot();
    render(<Library />);
    fireEvent.change(screen.getByLabelText("Filter state"), { target: { value: "Ogun" } });
    expect(screen.queryByRole("heading", { name: "Reserved Epe plot" })).not.toBeInTheDocument();
    expect(screen.getByText("No reservations match these filters.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter state"), { target: { value: "" } });
    expect(screen.getByRole("heading", { name: "Reserved Epe plot" })).toBeInTheDocument();
  });
});
