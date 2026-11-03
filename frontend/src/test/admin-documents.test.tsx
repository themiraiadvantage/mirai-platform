import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LiveAdminDocuments } from "@/features/admin/LiveAdminDocuments";
import type { LiveDocument } from "@/lib/document-api";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  readFile: vi.fn(),
  download: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  allocated: false,
  fail: false,
}));
vi.mock("@/lib/session", () => ({ useSession: () => ({ id: "admin", name: "Admin" }) }));
vi.mock("@/lib/announcement-api", () => ({
  authenticatedRequest: (...args: unknown[]) => mocks.auth(...args),
}));
vi.mock("@/lib/document-api", async (original) => ({
  ...(await original<typeof import("@/lib/document-api")>()),
  documentFile: (...args: unknown[]) => mocks.readFile(...args),
  downloadDocument: (...args: unknown[]) => mocks.download(...args),
}));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
const doc: LiveDocument = {
  id: "doc-1",
  plotId: "plot-1",
  name: "Saved survey plan",
  mime: "application/pdf",
  kind: "LISTING_DOCUMENT",
  category: "Survey plan",
  notes: "Private notes",
  recipientId: null,
  recipient: null,
  recordVersion: 3,
  fileVersion: 2,
  createdAt: "2026-11-02T10:00:00Z",
  updatedAt: "2026-11-02T10:00:00Z",
  plot: { code: "MR-001", title: "Epe plot", publication: "Published" },
  _count: { allocations: 0 },
  versions: [
    {
      id: "v1",
      number: 1,
      name: "survey-original.pdf",
      mime: "application/pdf",
      size: 1024,
      uploadedBy: "Admin",
      createdAt: "2026-11-02T10:00:00Z",
    },
  ],
};
beforeEach(() => {
  mocks.allocated = false;
  mocks.fail = false;
  mocks.download.mockReset().mockResolvedValue(undefined);
  mocks.success.mockReset();
  mocks.readFile
    .mockReset()
    .mockResolvedValue({ name: "upload.pdf", mime: "application/pdf", base64: "JVBERi0=" });
  mocks.auth.mockReset().mockImplementation(async (path: string, options?: RequestInit) => {
    if (options?.method === "POST") {
      if (mocks.fail) throw new Error("This document changed. Reload it before saving.");
      return doc;
    }
    if (path.includes("/buyers"))
      return {
        items: [{ id: "buyer-1", name: "Paul Buyer", email: "paul@example.com" }],
        nextCursor: null,
      };
    if (path.startsWith("/admin/documents/plots"))
      return {
        items: [{ id: "plot-1", code: "MR-001", title: "Epe plot", publication: "Published" }],
        nextCursor: null,
      };
    const row = { ...doc, _count: { allocations: mocks.allocated ? 1 : 0 } };
    if (path === "/admin/documents/doc-1") return row;
    return {
      items: [row],
      total: 1,
      nextCursor: null,
      stats: { total: 1, listing: 1, buyer: 0, staff: 0 },
    };
  });
});
afterEach(cleanup);
describe("backend admin documents", () => {
  it("lists saved files and downloads the authenticated document", async () => {
    render(<LiveAdminDocuments />);
    expect(await screen.findByText("Saved survey plan")).toBeInTheDocument();
    expect(screen.queryByText("Awaiting review")).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Review" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Uploaded" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(mocks.download).toHaveBeenCalledWith(
      "/admin/documents/doc-1/download",
      "Saved survey plan",
    );
  });
  it("uploads a real file with plot and buyer visibility details", async () => {
    render(<LiveAdminDocuments />);
    await screen.findByText("Saved survey plan");
    fireEvent.click(screen.getByRole("button", { name: "Upload document" }));
    const dialog = within(screen.getByRole("dialog"));
    await dialog.findByRole("option", { name: "MR-001 · Epe plot" });
    fireEvent.change(dialog.getByLabelText("Document plot"), { target: { value: "plot-1" } });
    fireEvent.change(dialog.getByLabelText("Document name"), {
      target: { value: "Buyer allocation letter" },
    });
    const file = new File(["%PDF-1.4"], "upload.pdf", { type: "application/pdf" });
    fireEvent.change(dialog.getByLabelText("Document file"), { target: { files: [file] } });
    fireEvent.change(dialog.getByLabelText("Document visibility"), {
      target: { value: "Buyer only" },
    });
    await dialog.findByRole("option", { name: "Paul Buyer · paul@example.com" });
    fireEvent.change(dialog.getByLabelText("Document buyer"), { target: { value: "buyer-1" } });
    expect(dialog.queryByLabelText("Review status")).not.toBeInTheDocument();
    // jsdom does not populate a file input's native value from synthetic files.
    fireEvent.submit(dialog.getByRole("button", { name: "Upload document" }).closest("form")!);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Document uploaded"));
    const call = mocks.auth.mock.calls.find(
      ([path, options]) => path === "/admin/documents" && options?.method === "POST",
    );
    expect(JSON.parse(call![1].body)).toEqual(
      expect.objectContaining({
        plotId: "plot-1",
        name: "Buyer allocation letter",
        visibility: "Buyer only",
        buyerId: "buyer-1",
        file: expect.objectContaining({ name: "upload.pdf" }),
      }),
    );
    expect(mocks.readFile).toHaveBeenCalledWith(file);
  });
  it("shows real version history with protected download links", async () => {
    render(<LiveAdminDocuments />);
    await screen.findByText("Saved survey plan");
    fireEvent.click(screen.getByRole("button", { name: "View & history" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(await dialog.findByText("v1 · survey-original.pdf")).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Download" }));
    expect(mocks.download).toHaveBeenCalledWith(
      "/admin/documents/doc-1/versions/1/download",
      "survey-original.pdf",
    );
  });
  it("keeps a stale edit open with the backend error and record version", async () => {
    mocks.fail = true;
    render(<LiveAdminDocuments />);
    await screen.findByText("Saved survey plan");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    expect(await dialog.findByRole("alert")).toHaveTextContent("This document changed.");
    const call = mocks.auth.mock.calls.find(
      ([path, options]) => path === "/admin/documents/doc-1" && options?.method === "POST",
    );
    expect(JSON.parse(call![1].body).version).toBe(3);
  });
  it("keeps allocated ownership records read-only", async () => {
    mocks.allocated = true;
    render(<LiveAdminDocuments />);
    await screen.findByText("Saved survey plan");
    expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download" })).not.toBeDisabled();
  });
});
