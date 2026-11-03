"use client";
import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ApiError, apiRequest } from "@/lib/api";
import { getAccessToken, signOut, useSession } from "@/lib/session";
import { safeRedirect } from "@/lib/navigation";
import { AdminStartup } from "./AdminStartup";

export const STAFF_ROLES = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  LISTING_MANAGER: "Listing Manager",
  VERIFICATION_REVIEWER: "Verification Reviewer",
  PAYMENT_SUPPORT: "Payment Support",
  DOCUMENT_ADMINISTRATOR: "Document Administrator",
  SITE_CHECK_CONTRIBUTOR: "Site Check Contributor",
} as const;
export type AdminAccess = {
  user: {
    id: string;
    name: string;
    email: string;
    staffRole: keyof typeof STAFF_ROLES;
    staffActive: boolean;
  };
  permissions: string[];
};
const AccessContext = createContext<AdminAccess | null>(null);
export function useAdminAccess() {
  const access = useContext(AccessContext);
  if (!access) throw new Error("Admin access is required");
  return access;
}
export async function adminRequest<T>(path: string, options: RequestInit = {}) {
  const token = await getAccessToken();
  return apiRequest<T>(`/admin/auth${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  });
}
export function adminDestination(value: string | null) {
  const path = safeRedirect(value);
  return /^\/admin(?:\/|$)/.test(path) && !/^\/admin\/(login|set-password)(?:[/?#]|$)/.test(path)
    ? path
    : "/admin";
}
export function AdminGate({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const [result, setResult] = useState<AdminAccess | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let checking = false;
    setError("");
    const login = () =>
      router.replace(
        `/admin/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`,
      );
    if (session === null) {
      login();
      return;
    }
    if (!session) return;
    async function check() {
      if (checking) return;
      checking = true;
      try {
        const access = await adminRequest<AdminAccess>("/me");
        if (!cancelled) {
          setResult(access);
          setError("");
        }
      } catch (e) {
        if (cancelled) return;
        setResult(null);
        if (e instanceof ApiError && e.status === 401) login();
        setError(e instanceof Error ? e.message : "Unable to check admin access.");
      } finally {
        checking = false;
      }
    }
    void check();
    window.addEventListener("focus", check);
    const timer = setInterval(check, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [session, router, retry]);
  const access = result?.user.id === session?.id ? result : null;
  if (error)
    return (
      <AdminStartup>
        <section className="admin-panel p-8">
          <h1>Admin access unavailable</h1>
          <p role="alert">{error}</p>
          <button onClick={() => setRetry((x) => x + 1)}>Try again</button>{" "}
          <Link href="/admin">Overview</Link>
          <button
            onClick={async () => {
              await signOut();
              router.replace("/admin/login");
            }}
          >
            Sign out
          </button>
        </section>
      </AdminStartup>
    );
  if (!access) return <AdminStartup />;
  return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>;
}

export function AdminPageAccess({ children }: { children: React.ReactNode }) {
  const access = useAdminAccess();
  const pathname = usePathname();
  const section = pathname === "/admin" ? "dashboard" : pathname.split("/")[2];
  if (!access.permissions.includes(section))
    return (
      <section className="admin-panel p-8">
        <h1>Section unavailable</h1>
        <p role="alert">Your role does not have access to this section.</p>
        <Link href="/admin" className="admin-text-link">
          Back to overview
        </Link>
      </section>
    );
  return children;
}
