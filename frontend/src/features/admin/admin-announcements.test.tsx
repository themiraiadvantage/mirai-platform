import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AdminAnnouncements } from "./AdminAnnouncements";
const mocks = vi.hoisted(() => ({ api: vi.fn(), success: vi.fn() }));
vi.mock("@/lib/announcement-api", async (original) => ({
  ...(await original<typeof import("@/lib/announcement-api")>()),
  authenticatedRequest: mocks.api,
}));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: vi.fn() } }));
const buyer = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Buyer One",
  email: "buyer@example.com",
};
const draft = {
  id: "draft-1",
  title: "Inspection update",
  body: "Please arrive at 10am.",
  audience: "ALL_BUYERS",
  buyerIds: [],
  selectedBuyers: [],
  status: "DRAFT",
  author: { name: "Admin" },
  createdAt: "2026-10-30T10:00:00Z",
  publishedAt: null,
  recipientCount: 0,
  readCount: 0,
};
beforeEach(() => {
  mocks.api.mockReset();
  mocks.success.mockReset();
  mocks.api.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path.includes("/buyers")) return { items: [buyer], total: 1 };
    if (options?.method === "POST") return { id: "draft-1" };
    return { items: [], nextCursor: null, stats: { drafts: 0, published: 0, delivered: 0 } };
  });
});
afterEach(cleanup);
async function compose() {
  render(<AdminAnnouncements />);
  await screen.findByText("Your next update starts here");
  fireEvent.click(screen.getAllByRole("button", { name: "Create announcement" })[0]);
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Inspection update" } });
  fireEvent.change(screen.getByLabelText("Message"), {
    target: { value: "Please arrive at 10am." },
  });
}
describe("admin announcements", () => {
  it("reviews and publishes a saved draft with the chosen audience", async () => {
    await compose();
    fireEvent.click(screen.getByRole("button", { name: "Review & publish" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Please arrive at 10am.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish announcement" }));
    await waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith(
        "Announcement published. Buyer notifications are ready.",
      ),
    );
    const saved = mocks.api.mock.calls.find(
      ([path, options]) => path === "/admin/announcements" && options?.method === "POST",
    );
    expect(JSON.parse(saved![1].body)).toEqual({
      title: "Inspection update",
      body: "Please arrive at 10am.",
      audience: "ALL_BUYERS",
      buyerIds: [],
    });
    expect(mocks.api).toHaveBeenCalledWith("/admin/announcements/draft-1/publish", {
      method: "POST",
    });
  });
  it("uses real selected buyer IDs and saving a draft does not publish", async () => {
    await compose();
    fireEvent.click(screen.getByRole("radio", { name: /Selected buyers/ }));
    const checkbox = await screen.findByRole("checkbox", { name: /Buyer One/ });
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Draft saved"));
    const saved = mocks.api.mock.calls.find(
      ([path, options]) => path === "/admin/announcements" && options?.method === "POST",
    );
    expect(JSON.parse(saved![1].body).buyerIds).toEqual([buyer.id]);
    expect(mocks.api.mock.calls.some(([path]) => path.endsWith("/publish"))).toBe(false);
  });
  it("retries publishing without creating or updating another draft", async () => {
    let attempts = 0;
    const standard = mocks.api.getMockImplementation()!;
    mocks.api.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path.endsWith("/publish") && ++attempts === 1) throw new Error("Connection lost");
      return standard(path, options);
    });
    await compose();
    fireEvent.click(screen.getByRole("button", { name: "Review & publish" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish announcement" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost");
    fireEvent.click(screen.getByRole("button", { name: "Publish announcement" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalled());
    expect(
      mocks.api.mock.calls.filter(
        ([path, options]) => path === "/admin/announcements" && options?.method === "POST",
      ),
    ).toHaveLength(1);
    expect(mocks.api.mock.calls.filter(([path]) => path.endsWith("/publish"))).toHaveLength(2);
    expect(
      mocks.api.mock.calls.some(
        ([path, options]) => path === "/admin/announcements/draft-1" && options?.method === "POST",
      ),
    ).toBe(false);
  });
  it("keeps published announcements read-only and shows delivery counts", async () => {
    mocks.api.mockResolvedValue({
      items: [
        {
          ...draft,
          status: "PUBLISHED",
          publishedAt: draft.createdAt,
          recipientCount: 3,
          readCount: 1,
        },
      ],
      nextCursor: null,
      stats: { drafts: 0, published: 1, delivered: 3 },
    });
    render(<AdminAnnouncements />);
    fireEvent.click(await screen.findByRole("button", { name: "View announcement" }));
    expect(screen.getByText("3 notifications delivered · 1 read")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save draft" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });
  it("reports a failed load instead of showing sample announcements", async () => {
    mocks.api.mockRejectedValue(new Error("Unable to reach server"));
    render(<AdminAnnouncements />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to reach server");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
