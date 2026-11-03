import { afterEach, expect, it, vi } from "vitest";
import { apiRequest, ApiError } from "@/lib/api";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("keeps structured publication issues alongside the normal error message", async () => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:4000/api/v1");
  const body = {
    message: "Complete these items before publishing.",
    publicationIssues: [{ code: "photo", section: "Files", message: "Upload a Listing photo." }],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => body }),
  );
  try {
    await apiRequest("/admin/plots/test", { method: "POST" });
    throw new Error("Expected a rejected request");
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: body.message, status: 400, details: body });
  }
});
