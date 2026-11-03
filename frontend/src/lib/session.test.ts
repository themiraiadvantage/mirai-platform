import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
const credentials = {
  accessToken: "private-access-token",
  expiresIn: 900,
  user: {
    id: "buyer-1",
    email: "buyer@example.com",
    name: "Test Buyer",
    emailVerifiedAt: "2026-10-21T12:00:00Z",
  },
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("backend session lifecycle", () => {
  it("uses admin login and maps staff access only from the backend", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        response({
          ...credentials,
          user: { ...credentials.user, staffRole: "SUPER_ADMIN", staffActive: true },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const store = await import("./session");
    const profile = await store.signIn("owner@example.com", "PrivatePassword1!", true);
    expect(profile.staffRole).toBe("Super Admin");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/admin/login"),
      expect.anything(),
    );
    fetch.mockResolvedValue(
      response({
        ...credentials,
        user: { ...credentials.user, staffRole: "SUPER_ADMIN", staffActive: false },
      }),
    );
    const inactive = await store.refreshSession();
    expect(inactive.staffRole).toBeUndefined();
  });
  it("does not authenticate a forged or legacy browser-local staff session", async () => {
    localStorage.setItem(
      "mirai-session",
      JSON.stringify({ email: "admin@example.com", staffRole: "Super Admin" }),
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ message: "Unauthorized" }, 401)));
    const store = await import("./session");
    await store.initializeSession();
    const { result } = renderHook(store.useSession);
    expect(result.current).toBeNull();
    expect(localStorage.getItem("mirai-session")).toBeNull();
  });
  it("keeps tokens out of browser storage and normalizes login email", async () => {
    const fetch = vi.fn().mockResolvedValue(response(credentials));
    vi.stubGlobal("fetch", fetch);
    const store = await import("./session");
    await store.signIn(" Buyer@Example.com ", "secret-password-123");
    expect(await store.getAccessToken()).toBe(credentials.accessToken);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      expect.objectContaining({
        credentials: "include",
        body: JSON.stringify({ email: "buyer@example.com", password: "secret-password-123" }),
      }),
    );
    expect(localStorage.getItem("mirai-session")).not.toContain("private-access-token");
    expect(localStorage.getItem("mirai-session")).not.toContain("secret-password-123");
    const { result } = renderHook(store.useSession);
    expect(result.current?.name).toBe("Test Buyer");
    expect(result.current?.staffRole).toBeUndefined();
  });
  it("serializes simultaneous refresh requests to avoid token replay", async () => {
    const fetch = vi.fn().mockResolvedValue(response(credentials));
    vi.stubGlobal("fetch", fetch);
    const store = await import("./session");
    await Promise.all([store.refreshSession(), store.refreshSession(), store.refreshSession()]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("revokes the backend session when signing out", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(credentials))
      .mockResolvedValueOnce(response({ message: "Signed out" }));
    vi.stubGlobal("fetch", fetch);
    const store = await import("./session");
    await store.signIn("buyer@example.com", "secret-password-123");
    const { result } = renderHook(store.useSession);
    await act(() => store.signOut());
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining("/auth/logout"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer private-access-token" }),
      }),
    );
    expect(result.current).toBeNull();
    expect(localStorage.getItem("mirai-session")).toBeNull();
  });
});
