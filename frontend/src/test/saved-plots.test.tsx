import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SavePlotButton, SavedPlotsProvider } from "@/components/mirai/SavedPlots";
import { SavedPlotsGrid } from "@/features/dashboard/SavedPlotsGrid";
const mocks = vi.hoisted(() => ({
  userId: "buyer-a" as string | null,
  auth: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  ids: new Map<string, Set<string>>(),
  fail: false,
  withdrawn: false,
}));
vi.mock("@/lib/session", () => ({
  useSession: () => (mocks.userId ? { id: mocks.userId, name: "Buyer" } : null),
}));
vi.mock("@/lib/announcement-api", () => ({
  authenticatedRequest: (...args: unknown[]) => mocks.auth(...args),
}));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
beforeEach(() => {
  mocks.userId = "buyer-a";
  mocks.ids = new Map();
  mocks.fail = false;
  mocks.withdrawn = false;
  mocks.error.mockReset();
  mocks.success.mockReset();
  mocks.auth.mockReset().mockImplementation(async (path: string, options?: RequestInit) => {
    const ids = mocks.ids.get(mocks.userId!) || new Set<string>();
    mocks.ids.set(mocks.userId!, ids);
    if (options?.method === "POST") {
      if (mocks.fail) throw new Error("Could not reach MIRAI.");
      const body = JSON.parse(String(options.body));
      if (body.saved) ids.add(body.plotId);
      else ids.delete(body.plotId);
      return body;
    }
    if (path === "/saved-plots/ids") return { ids: [...ids], total: ids.size };
    return {
      items: ids.has("plot-1")
        ? [
            {
              id: "saved-1",
              plotId: "plot-1",
              savedAt: "2026-11-02T10:00:00Z",
              plot: mocks.withdrawn
                ? null
                : {
                    id: "plot-1",
                    code: "MR-001",
                    title: "Epe shortlist plot",
                    location: "Epe",
                    state: "Lagos",
                    size: 600,
                    price: "6000000",
                    availability: "Available",
                    assets: [{ id: "photo-1" }],
                  },
            },
          ]
        : [],
      total: ids.size,
      nextCursor: null,
    };
  });
});
afterEach(cleanup);
describe("account saved plots", () => {
  it("prompts a visitor to sign in and preserves the plot destination", () => {
    mocks.userId = null;
    render(
      <SavedPlotsProvider>
        <SavePlotButton plotId="plot-1" code="MR-001" />
      </SavedPlotsProvider>,
    );
    expect(screen.getByRole("link", { name: "Sign in to save plot" })).toHaveAttribute(
      "href",
      "/sign-in?redirect=%2Fdashboard%2Fexplore%2FMR-001",
    );
  });
  it("saves and unsaves through the backend with a pressed bookmark state", async () => {
    render(
      <SavedPlotsProvider>
        <SavePlotButton plotId="plot-1" code="MR-001" />
      </SavedPlotsProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save plot" })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save plot" }));
    expect(await screen.findByRole("button", { name: "Unsave plot" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(mocks.auth).toHaveBeenCalledWith(
      "/saved-plots",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ plotId: "plot-1", saved: true }),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Unsave plot" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save plot" })).toHaveAttribute(
        "aria-pressed",
        "false",
      ),
    );
  });
  it("restores saved state and shows compact listing cards that can be removed", async () => {
    mocks.ids.set("buyer-a", new Set(["plot-1"]));
    render(
      <SavedPlotsProvider>
        <SavedPlotsGrid query="" state="" clearFilters={vi.fn()} />
      </SavedPlotsProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Epe shortlist plot" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View plot" })).toHaveAttribute(
      "href",
      "/dashboard/explore/MR-001",
    );
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      expect.stringContaining("/plots/assets/photo-1"),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Unsave plot" })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Unsave plot" }));
    expect(
      await screen.findByRole("heading", { name: "Save the plots you want to come back to." }),
    ).toBeInTheDocument();
  });
  it("does not display another account's saved state after switching users", async () => {
    mocks.ids.set("buyer-a", new Set(["plot-1"]));
    const content = (
      <SavedPlotsProvider>
        <SavePlotButton plotId="plot-1" code="MR-001" />
      </SavedPlotsProvider>
    );
    const view = render(content);
    await screen.findByRole("button", { name: "Unsave plot" });
    mocks.userId = "buyer-b";
    view.rerender(
      <SavedPlotsProvider>
        <SavePlotButton plotId="plot-1" code="MR-001" />
      </SavedPlotsProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save plot" })).not.toBeDisabled(),
    );
    expect(screen.getByRole("button", { name: "Save plot" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
  it("keeps a failed save unsaved and exposes a retryable error", async () => {
    mocks.fail = true;
    render(
      <SavedPlotsProvider>
        <SavePlotButton plotId="plot-1" code="MR-001" />
      </SavedPlotsProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save plot" })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save plot" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Could not reach MIRAI."));
    expect(screen.getByRole("button", { name: "Save plot" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
