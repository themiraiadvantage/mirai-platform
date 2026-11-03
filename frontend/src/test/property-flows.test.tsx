import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LivePlotEditor } from "@/features/admin/LiveAdminPlots";
import { LiveAdminCoOwnership } from "@/features/admin/LiveAdminCoOwnership";
import { StartCoOwnership, BuyerCoOwnership } from "@/features/dashboard/BuyerCoOwnership";
import type { CoRequest, LivePlot, Policy } from "@/lib/property-api";
const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  auth: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  owner: true,
  userId: "buyer-1",
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ apiRequest: (...args: unknown[]) => mocks.api(...args) }));
vi.mock("@/lib/announcement-api", () => ({
  authenticatedRequest: (...args: unknown[]) => mocks.auth(...args),
}));
vi.mock("@/lib/session", () => ({
  useSession: () => ({ id: mocks.userId, name: "Buyer" }),
  getAccessToken: vi.fn().mockResolvedValue("token"),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));
vi.mock("@/features/admin/admin-auth", () => ({
  useAdminAccess: () => ({ user: { staffRole: mocks.owner ? "SUPER_ADMIN" : "ADMIN" } }),
}));
vi.mock("@/components/mirai/SiteChrome", () => ({
  PublicLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
const policy: Policy = {
  id: "policy-1",
  version: 2,
  title: "Approved co-ownership terms",
  body: "Each partner contributes equally. Allocation follows full payment and signed documents.",
  createdAt: "2026-11-01T12:00:00Z",
};
const plot: LivePlot = {
  id: "plot-1",
  code: "MR-LIVE",
  title: "Live Epe listing",
  description: "Saved listing",
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
  verification: "verified",
  coEnabled: true,
  coMonths: 3,
  coDepositPercent: 10,
  version: 4,
  updatedAt: "2026-11-01T12:00:00Z",
  createdAt: "2026-11-01T10:00:00Z",
  details: {
    plans: ["Outright"],
    latitude: 6.5,
    longitude: 3.5,
    siteStatus: "Site visit complete",
    docSummary: "Reviewed documents",
  },
  assets: [],
};
const request: CoRequest = {
  id: "request-1",
  userId: "buyer-1",
  user: { id: "buyer-1", name: "Paul Buyer", email: "buyer@example.com" },
  plotId: plot.id,
  plot,
  policyId: policy.id,
  policy,
  offer: {
    sharePercent: 50,
    land: 3000000,
    legalFee: 50000,
    surveyFee: 100000,
    documentationFee: 50000,
    total: 3200000,
    deposit: 300000,
    months: 3,
  },
  preference: "",
  status: "PROPOSED",
  matchId: "match-1",
  acceptedAt: null,
  createdAt: "2026-11-01T12:00:00Z",
  contributions: [],
  match: {
    id: "match-1",
    status: "PROPOSED",
    agreement: "Both partners review this actual agreement before acceptance.",
    requests: [
      { id: "request-1", userId: "buyer-1", user: { name: "Paul Buyer" }, acceptedAt: null },
      { id: "request-2", userId: "buyer-2", user: { name: "Other Buyer" }, acceptedAt: null },
    ],
    allocations: [],
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.owner = true;
  mocks.userId = "buyer-1";
  window.history.replaceState({}, "", "/dashboard/co-own");
});
afterEach(cleanup);
describe("live property flows", () => {
  it("saves admin drafts through the API with workspace defaults and no browser record", async () => {
    mocks.auth.mockImplementation((path: string, options?: RequestInit) => {
      if (!options) return Promise.resolve({ reservationFee: 45000, accessMonths: 9 });
      const fields = JSON.parse(String(options.body));
      return Promise.resolve({ ...plot, ...fields, id: "created-id", assets: [] });
    });
    render(<LivePlotEditor code="new" />);
    fireEvent.change(await screen.findByLabelText("Plot code"), { target: { value: "mr-new" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Actual new listing" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0]);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/admin/plots/MR-NEW"));
    const body = JSON.parse(
      mocks.auth.mock.calls.find((c) => c[0] === "/admin/plots" && c[1])![1].body,
    );
    expect(body).toMatchObject({
      code: "MR-NEW",
      title: "Actual new listing",
      publication: "Draft",
      reservationFee: 45000,
      accessMonths: 9,
    });
    expect(body.assets).toBeUndefined();
    expect(localStorage.getItem("mirai-admin-preview-v2")).toBeNull();
  });
  it("saves pricing and publication changes without resubmitting server metadata", async () => {
    let record = { ...plot, serverOnlyMetadata: "read-only" };
    mocks.auth.mockImplementation((path: string, options?: RequestInit) => {
      if (!options) return Promise.resolve(record);
      const fields = JSON.parse(String(options.body));
      record = { ...record, ...fields, version: record.version + 1 };
      return Promise.resolve(record);
    });
    render(<LivePlotEditor code={plot.code} />);
    await screen.findByLabelText("Title");
    fireEvent.click(screen.getByRole("button", { name: "Pricing" }));
    fireEvent.change(screen.getByLabelText("Legal fee (₦)"), { target: { value: "120000" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0]);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    fireEvent.change(screen.getByLabelText("Publication"), { target: { value: "Draft" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0]);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledTimes(2));
    const saves = mocks.auth.mock.calls.filter((c) => c[1]?.method === "POST");
    expect(saves).toHaveLength(2);
    const first = JSON.parse(saves[0][1].body);
    const second = JSON.parse(saves[1][1].body);
    expect(saves[0][0]).toBe(`/admin/plots/${plot.id}`);
    expect(first).toMatchObject({ legalFee: 120000, price: 6000000, version: 4 });
    expect(second).toMatchObject({ legalFee: 120000, publication: "Draft", version: 5 });
    for (const body of [first, second]) {
      expect(Object.keys(body).sort()).toEqual(
        [
          "code",
          "title",
          "description",
          "location",
          "lga",
          "state",
          "size",
          "price",
          "legalFee",
          "surveyFee",
          "documentationFee",
          "reservationFee",
          "accessMonths",
          "publication",
          "availability",
          "verification",
          "coEnabled",
          "coMonths",
          "coDepositPercent",
          "version",
          "details",
        ].sort(),
      );
    }
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("lets admin enable co-ownership on an unchecked plot and save it", async () => {
    mocks.auth.mockImplementation((path: string, options?: RequestInit) => {
      if (!options)
        return Promise.resolve({
          ...plot,
          publication: "Draft",
          verification: "unchecked",
          coEnabled: false,
        });
      return Promise.resolve({ ...plot, ...JSON.parse(String(options.body)) });
    });
    render(<LivePlotEditor code={plot.code} />);
    await screen.findByLabelText("Title");
    fireEvent.click(screen.getByRole("button", { name: "Co-ownership" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Enable co-ownership for this plot" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0]);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Listing saved to MIRAI"));
    const call = mocks.auth.mock.calls.find((c) => c[1]?.method === "POST")!;
    expect(JSON.parse(call[1].body)).toMatchObject({
      coEnabled: true,
      verification: "unchecked",
      publication: "Draft",
    });
  });
  it("lists exactly what is missing and opens Files with the required document visibility selected", async () => {
    const issues = [
      {
        code: "document",
        section: "Files",
        message:
          "Upload at least one Public listing document. Private allocation documents do not count.",
      },
    ];
    const failure = Object.assign(
      new Error("Complete these items before publishing, then save again."),
      { details: { publicationIssues: issues } },
    );
    mocks.auth.mockImplementation((path: string, options?: RequestInit) =>
      options ? Promise.reject(failure) : Promise.resolve(plot),
    );
    render(<LivePlotEditor code={plot.code} />);
    await screen.findByLabelText("Title");
    fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent(issues[0].message);
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      "Upload at least one file as a Listing photo",
    );
    fireEvent.click(screen.getByRole("button", { name: "Open Files" }));
    expect(screen.getByLabelText("File visibility")).toHaveValue("LISTING_DOCUMENT");
  });
  it("offers a draft save when publishing a new plot fails", async () => {
    mocks.auth.mockImplementation((path: string, options?: RequestInit) => {
      if (!options) return Promise.resolve({ reservationFee: 30000, accessMonths: 12 });
      const values = JSON.parse(String(options.body));
      if (values.publication === "Published")
        return Promise.reject(
          Object.assign(new Error("Complete these items before publishing."), {
            details: {
              publicationIssues: [
                {
                  code: "draft",
                  section: "Publish",
                  message: "Save this plot as a draft first so you can upload its files.",
                },
              ],
            },
          }),
        );
      return Promise.resolve({ ...plot, ...values });
    });
    render(<LivePlotEditor code="new" />);
    fireEvent.change(await screen.findByLabelText("Plot code"), { target: { value: "TEST-NEW" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    fireEvent.change(screen.getByLabelText("Publication"), { target: { value: "Published" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Save as draft" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/admin/plots/TEST-NEW"));
    expect(
      JSON.parse(mocks.auth.mock.calls.filter((c) => c[1]?.method === "POST").at(-1)![1].body)
        .publication,
    ).toBe("Draft");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("requires published terms and explicit consent before submitting a buyer request", async () => {
    mocks.api.mockResolvedValue({ items: [plot], policy, nextCursor: null });
    mocks.auth.mockResolvedValue(request);
    render(<StartCoOwnership workspace />);
    fireEvent.click(await screen.findByRole("button", { name: /MR-LIVE/ }));
    fireEvent.click(screen.getByRole("button", { name: "Review selected plot" }));
    const submit = screen.getByRole("button", { name: "Submit request" });
    expect(submit).toBeDisabled();
    expect(screen.getByText(/No payment is collected when you submit/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/dashboard/co-own"));
    const call = mocks.auth.mock.calls.find((c) => c[0] === "/co-ownership/requests")!;
    expect(JSON.parse(call[1].body)).toEqual({
      plotId: plot.id,
      policyId: policy.id,
      version: plot.version,
      accepted: true,
      preference: "",
    });
    expect(localStorage.length).toBe(0);
  });
  it("shows a real empty state when no published opportunities exist", async () => {
    mocks.api.mockResolvedValue({ items: [], policy: null, nextCursor: null });
    render(<StartCoOwnership workspace />);
    expect(await screen.findByText("No co-ownership plots available yet")).toBeInTheDocument();
    expect(screen.queryByText(/MR-4092/)).not.toBeInTheDocument();
    expect(mocks.auth).not.toHaveBeenCalled();
  });
  it("binds agreement acceptance to the displayed match and retains server failures", async () => {
    mocks.auth.mockImplementation((path: string, options?: RequestInit) =>
      options
        ? Promise.reject(new Error("Match changed. Reload."))
        : Promise.resolve({ items: [request], nextCursor: null, total: 1 }),
    );
    render(<BuyerCoOwnership />);
    expect(await screen.findByText(request.match!.agreement)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Accept this agreement" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Match changed. Reload."));
    const call = mocks.auth.mock.calls.find((c) => c[0].includes("/accept"))!;
    expect(JSON.parse(call[1].body)).toEqual({ matchId: "match-1" });
    expect(screen.getByRole("button", { name: "Accept this agreement" })).toBeInTheDocument();
  });
  it("records a confirmed contribution with a reference through the admin API", async () => {
    mocks.auth.mockImplementation((path: string, options?: RequestInit) => {
      if (options) return Promise.resolve({ id: "payment-1" });
      if (path.endsWith("/policy")) return Promise.resolve(policy);
      return Promise.resolve({
        items: [{ ...request, status: "ACTIVE" }],
        total: 1,
        nextCursor: null,
      });
    });
    render(<LiveAdminCoOwnership />);
    fireEvent.click(await screen.findByRole("button", { name: "Record contribution" }));
    fireEvent.change(screen.getByLabelText("Amount received (₦)"), { target: { value: "500000" } });
    fireEvent.change(screen.getByLabelText("Unique bank or payment reference"), {
      target: { value: "BANK-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm contribution" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Contribution recorded"));
    const call = mocks.auth.mock.calls.find((c) => c[0] === "/admin/co-ownership/contributions")!;
    expect(JSON.parse(call[1].body)).toMatchObject({
      requestId: request.id,
      amount: 500000,
      reference: "BANK-123",
    });
  });
  it("limits publishing shared terms to the Super Admin in the UI", async () => {
    mocks.owner = false;
    mocks.auth.mockResolvedValue({ items: [], total: 0, nextCursor: null });
    render(<LiveAdminCoOwnership />);
    await screen.findByText("No buyer requests in this view");
    expect(
      screen.queryByRole("button", { name: /Set up terms|Publish revised terms/ }),
    ).not.toBeInTheDocument();
  });
});
