import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminActivity } from "./AdminActivity";
import { AdminRecentActivity } from "./AdminRecentActivity";
import { activityCsv, type ActivityEvent } from "@/lib/activity";
const mocks = vi.hoisted(() => ({ api: vi.fn(), download: vi.fn() }));
vi.mock("@/lib/announcement-api", async (original) => ({
  ...(await original<typeof import("@/lib/announcement-api")>()),
  authenticatedRequest: mocks.api,
}));
vi.mock("@/lib/demo-store", () => ({ downloadText: mocks.download }));
const event: ActivityEvent = {
  id: "event-1",
  category: "SETTINGS",
  action: "Workspace settings updated",
  actorName: "Real Admin",
  actorRole: "SUPER_ADMIN",
  targetLabel: "MIRAI",
  detail: "Updated reservationFee.",
  createdAt: "2026-11-01T10:00:00Z",
  changes: { reservationFee: { before: 30000, after: 45000 } },
};
beforeEach(() => {
  localStorage.clear();
  mocks.api.mockReset();
  mocks.download.mockReset();
  mocks.api.mockResolvedValue({ items: [event], total: 1, nextCursor: null });
});
afterEach(cleanup);
describe("backend activity history", () => {
  it("uses the same real events in the overview recent activity feed", async () => {
    render(<AdminRecentActivity />);
    expect(await screen.findByText("Workspace settings updated")).toBeInTheDocument();
    expect(screen.getByText("MIRAI · Real Admin")).toBeInTheDocument();
    expect(mocks.api).toHaveBeenCalledWith("/admin/activity");
  });
  it("loads recorded events and ignores browser-local sample history", async () => {
    localStorage.setItem(
      "mirai-admin-preview-v2",
      JSON.stringify({ audit: [{ actor: "Fake local actor" }] }),
    );
    render(<AdminActivity />);
    expect(await screen.findByText("Real Admin")).toBeInTheDocument();
    expect(mocks.api).toHaveBeenCalledWith("/admin/activity");
    expect(screen.queryByText("Fake local actor")).not.toBeInTheDocument();
    expect(screen.queryByText(/preview workspace/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Default reservation fee (₦)");
    expect(screen.getByRole("dialog")).toHaveTextContent("30000");
    expect(screen.getByRole("dialog")).toHaveTextContent("45000");
  });
  it("sends search, category, and Lagos date filters to the backend", async () => {
    render(<AdminActivity />);
    await screen.findByText("Real Admin");
    fireEvent.change(screen.getByPlaceholderText("Search activity, team member or record…"), {
      target: { value: "Real Admin" },
    });
    await waitFor(() => expect(mocks.api.mock.calls.at(-1)?.[0]).toContain("q=Real+Admin"));
    fireEvent.change(screen.getByLabelText("Activity type"), { target: { value: "SETTINGS" } });
    await waitFor(() => expect(mocks.api.mock.calls.at(-1)?.[0]).toContain("category=SETTINGS"));
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-11-01" } });
    await waitFor(() =>
      expect(decodeURIComponent(mocks.api.mock.calls.at(-1)?.[0])).toContain(
        "from=2026-10-31T23:00:00.000Z",
      ),
    );
  });
  it("exports only the loaded real events", async () => {
    render(<AdminActivity />);
    await screen.findByText("Real Admin");
    fireEvent.click(screen.getByRole("button", { name: "Export shown events" }));
    expect(mocks.download).toHaveBeenCalledWith(
      "mirai-activity.csv",
      activityCsv([event]),
      "text/csv;charset=utf-8",
    );
  });
  it("loads older events without duplicating the existing rows", async () => {
    mocks.api
      .mockResolvedValueOnce({ items: [event], total: 2, nextCursor: "cursor-1" })
      .mockResolvedValueOnce({
        items: [{ ...event, id: "event-2", actorName: "Another admin" }],
        total: 2,
        nextCursor: null,
      });
    render(<AdminActivity />);
    await screen.findByText("Real Admin");
    fireEvent.click(screen.getByRole("button", { name: "Load older events" }));
    expect(await screen.findByText("Another admin")).toBeInTheDocument();
    expect(screen.getAllByText("Real Admin")).toHaveLength(1);
    expect(mocks.api.mock.calls[1][0]).toContain("cursor=cursor-1");
  });
  it("shows connection errors with retry instead of sample records", async () => {
    mocks.api.mockRejectedValueOnce(new Error("Unable to load activity"));
    render(<AdminActivity />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load activity");
    expect(screen.queryByText("Real Admin")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Real Admin")).toBeInTheDocument();
  });
  it("protects CSV cells from formulas and escapes quotes", () => {
    const csv = activityCsv([
      { ...event, actorName: '=HYPERLINK("bad")', targetLabel: 'A "quoted" record' },
    ]);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"A ""quoted"" record"');
  });
});
