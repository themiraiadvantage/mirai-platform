import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  BuyerNotificationsProvider,
  useBuyerNotifications,
} from "@/components/mirai/BuyerNotifications";
import { NotificationInbox } from "./NotificationInbox";
const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  session: { id: "buyer-1" },
  path: "/dashboard/notifications",
}));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.path }));
vi.mock("@/lib/session", () => ({ useSession: () => mocks.session }));
vi.mock("@/lib/announcement-api", async (original) => ({
  ...(await original<typeof import("@/lib/announcement-api")>()),
  authenticatedRequest: mocks.api,
}));
vi.mock("@/lib/demo-store", () => ({
  useDemo: () => ({ owned: [], read: [] }),
  mutateDemo: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const notice = {
  id: "notification-1",
  createdAt: "2026-10-30T10:00:00Z",
  readAt: null as string | null,
  announcement: {
    id: "announcement-1",
    title: "Inspection update",
    body: "First line.\nPlease arrive at 10am. <b>Plain text</b>",
    publishedAt: "2026-10-30T10:00:00Z",
  },
};
let rows: (typeof notice)[];
function Badge() {
  const inbox = useBuyerNotifications();
  return <output data-testid="bell-count">{inbox.unreadCount}</output>;
}
function View() {
  return (
    <BuyerNotificationsProvider>
      <Badge />
      <NotificationInbox />
    </BuyerNotificationsProvider>
  );
}
beforeEach(() => {
  mocks.session = { id: "buyer-1" };
  mocks.path = "/dashboard/notifications";
  rows = [structuredClone(notice)];
  mocks.api.mockReset();
  mocks.api.mockImplementation(async (path: string) => {
    if (path === "/notifications/read-all") {
      rows = rows.map((row) => ({ ...row, readAt: "2026-10-30T10:05:00Z" }));
      return { unreadCount: 0 };
    }
    if (path.endsWith("/read")) {
      rows = rows.map((row) => ({ ...row, readAt: "2026-10-30T10:05:00Z" }));
      return { notification: rows[0], unreadCount: 0 };
    }
    return { items: rows, unreadCount: rows.filter((row) => !row.readAt).length, nextCursor: null };
  });
});
afterEach(cleanup);
describe("live buyer notifications", () => {
  it("opens the full announcement, records reading, updates the shared bell, and survives reload", async () => {
    const view = render(<View />);
    fireEvent.click(await screen.findByRole("button", { name: "Read announcement" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("bell-count")).toHaveTextContent("0"));
    expect(screen.getByRole("dialog").textContent).toContain("<b>Plain text</b>");
    expect(screen.getByRole("dialog").querySelector("b")).toBeNull();
    expect(mocks.api).toHaveBeenCalledWith("/notifications/notification-1/read", {
      method: "POST",
    });
    view.unmount();
    render(<View />);
    await screen.findByRole("button", { name: "Read announcement" });
    expect(screen.getByTestId("bell-count")).toHaveTextContent("0");
  });
  it("marks all as read on the server and clears the unread count", async () => {
    render(<View />);
    await screen.findByRole("button", { name: "Read announcement" });
    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    await waitFor(() => expect(screen.getByTestId("bell-count")).toHaveTextContent("0"));
    expect(mocks.api).toHaveBeenCalledWith("/notifications/read-all", { method: "POST" });
  });
  it("refreshes on focus without replacing the inbox with a full-page loader", async () => {
    render(<View />);
    await screen.findByRole("button", { name: "Read announcement" });
    rows = [
      {
        ...notice,
        id: "notification-2",
        announcement: { ...notice.announcement, title: "Another update" },
      },
      ...rows,
    ];
    fireEvent(window, new Event("focus"));
    expect(await screen.findByRole("button", { name: "Another update" })).toBeInTheDocument();
    expect(screen.getByTestId("bell-count")).toHaveTextContent("2");
  });
  it("clears the previous buyer's feed and reading dialog when the account changes", async () => {
    const view = render(<View />);
    fireEvent.click(await screen.findByRole("button", { name: "Read announcement" }));
    await screen.findByRole("dialog");
    mocks.session = { id: "buyer-2" };
    mocks.api.mockImplementation(() => new Promise(() => {}));
    view.rerender(<View />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inspection update" })).not.toBeInTheDocument();
    expect(screen.getByTestId("bell-count")).toHaveTextContent("0");
  });
  it("shows retry on failure and does not replace the live feed with sample announcements", async () => {
    mocks.api.mockRejectedValue(new Error("Connection unavailable"));
    render(<View />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection unavailable");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
