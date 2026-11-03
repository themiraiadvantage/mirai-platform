import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AdminProvider,
  ADMIN_STORAGE_KEY,
  createAdminData,
  publicationIssues,
  savePreviewFile,
  type AdminData,
} from "./admin-store";
import { AdminReservations } from "./AdminOperations";
import AdminListingPreview from "./AdminPreview";
import { AdminStaff } from "./AdminManagement";
const mocks = vi.hoisted(() => ({ replace: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/admin");
});
afterEach(cleanup);
function stored(): AdminData {
  return JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY)!);
}

describe("admin publication and local file rules", () => {
  it("lets incomplete drafts exist but requires a complete listing before publishing", () => {
    const draft = {
      ...createAdminData().plots[0],
      code: "MR-NEW",
      publication: "Draft" as const,
      price: 0,
      cover: "",
      photos: [],
      beacons: [],
    };
    expect(draft.publication).toBe("Draft");
    expect(publicationIssues(draft, [])).toEqual(
      expect.arrayContaining([
        "Enter a land price",
        "Add a cover photo",
        "Add at least three boundary beacons",
        "Attach a listing document record",
      ]),
    );
    const state = createAdminData();
    expect(publicationIssues(state.plots[0], state.documents)).toEqual([]);
    const invalid = {
      ...state.plots[0],
      beacons: [{ id: "A", lat: 500, lng: 2 }, ...state.plots[0].beacons.slice(1)],
    };
    expect(publicationIssues(invalid, state.documents)).toContain("Correct the beacon coordinates");
  });
  it("does not count private buyer documents towards publication readiness", () => {
    const state = createAdminData();
    expect(
      publicationIssues(
        state.plots[0],
        state.documents.map((d) => ({ ...d, visibility: "Buyer only" })),
      ),
    ).toContain("Attach a listing document record");
  });
  it("rejects unsupported or oversized files before touching browser file storage", async () => {
    await expect(
      savePreviewFile(new File(["test"], "test.html", { type: "text/html" })),
    ).rejects.toThrow("Use PDF");
    const file = new File(["sample"], "large.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: 21 * 1024 * 1024 });
    await expect(savePreviewFile(file)).rejects.toThrow("20 MB");
  });
});

describe("working admin preview flows", () => {
  it("excludes reserved plots from a new reservation and saves the agreed price snapshot", async () => {
    render(
      <AdminProvider>
        <AdminReservations />
      </AdminProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Add reservation" }));
    const select = screen.getByLabelText("Plot");
    expect(Array.from(select.querySelectorAll("option")).some((o) => o.value === "MR-4092")).toBe(
      false,
    );
    const chosen = (select as HTMLSelectElement).value;
    fireEvent.click(screen.getByRole("button", { name: "Save reservation" }));
    await waitFor(() => expect(stored().reservations).toHaveLength(4));
    const state = stored();
    expect(state.reservations[0].agreedPrice).toBe(
      state.plots.find((p) => p.code === chosen)!.price,
    );
    expect(state.plots.find((p) => p.code === chosen)!.availability).toBe("Reserved");
  });
  it("does not expose buyer-only or staff-only documents in the listing preview", async () => {
    const state = createAdminData();
    state.documents.push(
      {
        ...state.documents[0],
        id: "PRIVATE-1",
        name: "Private signed agreement",
        visibility: "Buyer only",
        buyer: "BUY-001",
      },
      {
        ...state.documents[0],
        id: "PRIVATE-2",
        name: "Internal legal notes",
        visibility: "Staff only",
      },
    );
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(state));
    render(
      <AdminProvider>
        <AdminListingPreview code="MR-4092" />
      </AdminProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Documents" }));
    expect(screen.queryByText("Private signed agreement")).not.toBeInTheDocument();
    expect(screen.queryByText("Internal legal notes")).not.toBeInTheDocument();
    expect(screen.getByText("Survey plan")).toBeInTheDocument();
  });
  it("prevents removing the last active owner in the preview", async () => {
    render(
      <AdminProvider>
        <AdminStaff />
      </AdminProvider>,
    );
    const buttons = await screen.findAllByRole("button", { name: "Manage access" });
    fireEvent.click(buttons[0]);
    fireEvent.change(screen.getByLabelText("Access status"), { target: { value: "Suspended" } });
    fireEvent.click(screen.getByRole("button", { name: "Save staff record" }));
    expect(mocks.error).toHaveBeenCalledWith(
      "Keep at least one active Super Admin in the preview.",
    );
    expect(stored().staff[0].active).toBe(true);
  });
});
