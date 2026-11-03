"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Map,
  FolderOpen,
  Users,
  CalendarClock,
  Wallet,
  ClipboardCheck,
  Megaphone,
  History,
  Settings2,
  ArrowUpRight,
  Menu,
  X,
  ChevronDown,
  Handshake,
  Plus,
} from "lucide-react";
import { Logo } from "@/components/mirai/primitives";
import { ADMIN_STORAGE_KEY, AdminProvider, useAdmin } from "./admin-store";
import { AdminGate, AdminPageAccess, STAFF_ROLES, useAdminAccess } from "./admin-auth";
import { signOut } from "@/lib/session";
import { cn } from "@/lib/utils";

export const ADMIN_NAV = [
  { label: "Overview", path: "/admin", icon: LayoutDashboard, group: "WORKSPACE" },
  { label: "Plots", path: "/admin/plots", icon: Map, group: "WORKSPACE" },
  { label: "Documents", path: "/admin/documents", icon: FolderOpen, group: "WORKSPACE" },
  { label: "Buyers", path: "/admin/customers", icon: Users, group: "WORKSPACE" },
  { label: "Reservations", path: "/admin/reservations", icon: CalendarClock, group: "OPERATIONS" },
  { label: "Payments", path: "/admin/payments", icon: Wallet, group: "OPERATIONS" },
  { label: "Site checks", path: "/admin/site-checks", icon: ClipboardCheck, group: "OPERATIONS" },
  { label: "Co-ownership", path: "/admin/co-ownership", icon: Handshake, group: "OPERATIONS" },
  { label: "Announcements", path: "/admin/announcements", icon: Megaphone, group: "MANAGEMENT" },
  { label: "Staff & access", path: "/admin/staff", icon: Users, group: "MANAGEMENT" },
  { label: "Activity history", path: "/admin/audit", icon: History, group: "MANAGEMENT" },
  { label: "Settings", path: "/admin/settings", icon: Settings2, group: "MANAGEMENT" },
];

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signoutError, setSignoutError] = useState("");
  const access = useAdminAccess();
  const router = useRouter();
  const permitted = (path: string) =>
    access.permissions.includes(path === "/admin" ? "dashboard" : path.split("/")[2]);
  const initials = access.user.name
    .split(/\s+/)
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
  const { storageError } = useAdmin();
  const current = [...ADMIN_NAV]
    .reverse()
    .find(
      (item) =>
        pathname === item.path || (item.path !== "/admin" && pathname.startsWith(item.path + "/")),
    );
  return (
    <div className="admin-app">
      {open && (
        <button
          className="admin-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={cn("admin-sidebar", open && "is-open")}>
        <Link href="/admin" className="admin-brand" onClick={() => setOpen(false)}>
          <Logo dark />
          <span>ADMIN</span>
        </Link>
        <div className="admin-workspace-label">
          <span className="admin-workspace-mark">
            <Logo size="small" dark />
          </span>
          <div>
            MIRAI workspace<small>Property operations</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <nav aria-label="Admin navigation" className="admin-navigation">
          {["WORKSPACE", "OPERATIONS", "MANAGEMENT"].map((group) => (
            <div key={group} className="admin-nav-group">
              <p>{group}</p>
              {ADMIN_NAV.filter((item) => item.group === group && permitted(item.path)).map(
                ({ path, label, icon: Icon }) => {
                  const active =
                    pathname === path || (path !== "/admin" && pathname.startsWith(path + "/"));
                  return (
                    <Link
                      key={path}
                      href={path}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn("admin-nav-link", active && "active")}
                    >
                      <Icon size={17} strokeWidth={1.7} />
                      <span>{label}</span>
                    </Link>
                  );
                },
              )}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          {permitted("/admin/catalogue") && (
            <Link href="/admin/catalogue">
              Preview catalogue <ArrowUpRight size={15} />
            </Link>
          )}
          <div>
            <span className="admin-avatar">{initials}</span>
            <span>
              {access.user.name}
              <small>{STAFF_ROLES[access.user.staffRole]}</small>
            </span>
          </div>
        </div>
      </aside>
      <div className="admin-main-wrap">
        <header className="admin-topbar">
          <div className="flex items-center gap-3">
            <button
              className="admin-icon-button lg:hidden"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span className="admin-breadcrumb">
              Workspace <span>/</span>{" "}
              <strong>
                {current?.label ||
                  (pathname === "/admin/catalogue" ? "Catalogue preview" : "Overview")}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="admin-preview-badge">
              <i />
              Operations preview
            </span>
            {permitted("/admin/plots") && (
              <Link href="/admin/plots/new" className="admin-top-add">
                <Plus size={16} />
                Add plot
              </Link>
            )}
            <button
              className="admin-top-add"
              onClick={async () => {
                try {
                  await signOut();
                  router.replace("/admin/login");
                } catch (e) {
                  setSignoutError(e instanceof Error ? e.message : "Could not sign out.");
                }
              }}
            >
              Sign out
            </button>
          </div>
        </header>
        {storageError && (
          <p role="alert" className="admin-storage-warning">
            {storageError}
          </p>
        )}
        {signoutError && (
          <p role="alert" className="admin-storage-warning">
            {signoutError}
          </p>
        )}
        <main id="main-content" className="admin-content">
          <AdminPageAccess>{children}</AdminPageAccess>
        </main>
        <footer className="admin-footer">
          <span>MIRAI Admin</span>
        </footer>
      </div>
    </div>
  );
}
function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const access = useAdminAccess();
  return (
    <AdminProvider
      key={access.user.id}
      storageKey={`${ADMIN_STORAGE_KEY}:${access.user.id}`}
      actor={access.user.name}
      liveSettings
      frame={Shell}
    >
      {children}
    </AdminProvider>
  );
}
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login" || pathname === "/admin/set-password") return children;
  return (
    <AdminGate>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </AdminGate>
  );
}
