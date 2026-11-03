"use client";
import { useSyncExternalStore } from "react";
import type { StaffRole } from "./data";
import { apiRequest, ApiError } from "./api";

export type BuyerRole = "buyer" | "partner" | "developer";
export interface Session {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  role?: BuyerRole;
  staffRole?: StaffRole;
  lastLogin: string;
}
interface Credentials {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    name: string;
    email: string;
    emailVerifiedAt: string;
    staffRole?: string | null;
    staffActive?: boolean;
  };
}
let session: Session | null | undefined;
let accessToken: string | undefined;
let expiresAt = 0;
let refreshPromise: Promise<Session> | undefined;
let initialized = false;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function publish(value: Session | null) {
  session = value;
  // This profile key scopes existing browser-local plot records only.
  // Authentication never reads it, and no credential is persisted here.
  try {
    if (value) localStorage.setItem("mirai-session", JSON.stringify(value));
    else localStorage.removeItem("mirai-session");
  } catch {
    /* Authentication also works without browser storage. */
  }
  listeners.forEach((listener) => listener());
}
function clearSession() {
  clearTimeout(refreshTimer);
  accessToken = undefined;
  expiresAt = 0;
  publish(null);
}
function accept(result: Credentials): Session {
  if (!result.user.emailVerifiedAt)
    throw new ApiError("Please verify your email before signing in.", 403);
  accessToken = result.accessToken;
  expiresAt = Date.now() + result.expiresIn * 1000;
  clearTimeout(refreshTimer);
  const profile: Session = {
    id: result.user.id,
    name: result.user.name,
    email: result.user.email,
    role: "buyer",
    staffRole: result.user.staffActive ? staffRoleLabels[result.user.staffRole || ""] : undefined,
    lastLogin: new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos" }),
  };
  publish(profile);
  refreshTimer = setTimeout(
    () => {
      void refreshSession().catch(() => undefined);
    },
    Math.max(1000, result.expiresIn * 1000 - 60000),
  );
  return profile;
}
export function refreshSession(): Promise<Session> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = apiRequest<Credentials>("/auth/refresh", { method: "POST" })
    .then(accept)
    .catch((error: unknown) => {
      clearSession();
      throw error;
    })
    .finally(() => {
      refreshPromise = undefined;
    });
  return refreshPromise;
}
export async function initializeSession() {
  if (initialized) return;
  initialized = true;
  try {
    localStorage.removeItem("mirai-session");
  } catch {
    /* Optional profile cache. */
  }
  try {
    await refreshSession();
  } catch {
    /* No valid refresh cookie means signed out. */
  }
}
const staffRoleLabels: Record<string, StaffRole> = {
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
  LISTING_MANAGER: "Listing Manager",
  VERIFICATION_REVIEWER: "Verification Reviewer",
  PAYMENT_SUPPORT: "Payment Support",
  DOCUMENT_ADMINISTRATOR: "Document Administrator",
  SITE_CHECK_CONTRIBUTOR: "Site Check Contributor",
};
export async function signIn(email: string, password: string, admin = false) {
  // Finish mount-time restoration before issuing a new login cookie.
  if (refreshPromise) await refreshPromise.catch(() => undefined);
  const result = await apiRequest<Credentials>(admin ? "/auth/admin/login" : "/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  initialized = true;
  return accept(result);
}
export async function getAccessToken() {
  if (!accessToken || Date.now() >= expiresAt - 30000) await refreshSession();
  return accessToken!;
}
export async function signOut() {
  clearTimeout(refreshTimer);
  if (refreshPromise) await refreshPromise.catch(() => undefined);
  try {
    const token = await getAccessToken();
    clearTimeout(refreshTimer);
    await apiRequest("/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
  }
  clearSession();
  try {
    localStorage.setItem("mirai-auth-signout", String(Date.now()));
  } catch {
    /* Optional tab sync. */
  }
}
export function syncSignedOutTab(event: StorageEvent) {
  if (event.key === "mirai-auth-signout") clearSession();
}
export function updateSession(value: Partial<Session>) {
  if (session)
    publish({
      ...session,
      name: value.name ?? session.name,
      phone: value.phone ?? session.phone,
      role: value.role ?? session.role,
    });
}
export function useSession() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => session,
    () => undefined,
  );
}
