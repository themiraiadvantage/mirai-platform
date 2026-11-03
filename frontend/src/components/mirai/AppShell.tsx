"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Map,
  CreditCard,
  FolderLock,
  Bell,
  Compass,
  BookOpen,
  Users,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  ShieldCheck,
  ClipboardCheck,
  ScrollText,
  Megaphone,
} from "lucide-react";
import { Logo } from "./primitives";
import { WorkspaceLoading } from "./WorkspaceLoading";
import { signOut, useSession } from "@/lib/session";
import { toast } from "sonner";
import { ALERTS, PERMISSIONS } from "@/lib/data";
import { buyerAlerts } from "@/lib/notifications";
import { useBuyerNotifications } from "./BuyerNotifications";
import { useDemo } from "@/lib/demo-store";
import { cn } from "@/lib/utils";

const buyerLinks = [
  ["/dashboard", "Overview", LayoutDashboard],
  ["/dashboard/explore", "Explore plots", Compass],
  ["/dashboard/library", "Land Library", Map],
  ["/dashboard/payments", "Payments", CreditCard],
  ["/dashboard/documents", "Documents", FolderLock],
  ["/dashboard/co-own", "Co-ownership", Users],
  ["/dashboard/notifications", "Notifications", Bell],
  ["/dashboard/guide", "Buying guide", BookOpen],
] as const;
const adminLinks = [
  ["dashboard", "Overview", LayoutDashboard],
  ["plots", "Plots", Map],
  ["payments", "Payments", CreditCard],
  ["documents", "Documents", FolderLock],
  ["site-checks", "Site checks", ClipboardCheck],
  ["customers", "Customers", Users],
  ["announcements", "Announcements", Megaphone],
  ["audit", "Audit trail", ScrollText],
  ["staff", "Staff", Users],
] as const;
export function AppShell({
  children,
  admin = false,
}: {
  children: React.ReactNode;
  admin?: boolean;
}) {
  const session = useSession(),
    demo = useDemo(),
    pathname = usePathname(),
    router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const notifications = useBuyerNotifications();
  useEffect(() => {
    if (session === null)
      router.replace(
        `/sign-in?redirect=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`,
      );
  }, [session, pathname, router]);
  if (!session) return <WorkspaceLoading />;
  if (admin && !session.staffRole)
    return (
      <main className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <ShieldCheck className="mx-auto mb-4 text-gold" />
          <h1 className="text-3xl">Staff access required</h1>
          <p className="mt-3 text-muted-foreground">
            This account does not have access to the staff workspace.
          </p>
          <Link href="/sign-in" className="mt-6 inline-block text-primary-bright">
            Go to sign in →
          </Link>
        </div>
      </main>
    );
  const links = admin
    ? adminLinks
        .filter(([key]) => PERMISSIONS[session.staffRole!].includes(key))
        .map(
          ([key, label, Icon]) =>
            [key === "dashboard" ? "/admin" : `/admin/${key}`, label, Icon] as const,
        )
    : buyerLinks;
  const unread =
    buyerAlerts(demo?.owned.map((o) => o.code) || [], undefined).filter(
      (a) => a.type !== "announcement" && a.unread && !demo?.read.includes(a.id),
    ).length + notifications.unreadCount;
  return (
    <div className="workspace min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-card transition-[width] duration-200 lg:flex",
          collapsed ? "w-20" : "w-64",
        )}
      >
        <Link href="/dashboard" className="flex h-[72px] shrink-0 items-center px-6">
          <Logo size={collapsed ? "small" : "normal"} />
        </Link>
        {!collapsed && (
          <div className="mx-6 mb-3 shrink-0 border-b border-border pb-3 text-xs font-medium tracking-wide text-muted-foreground">
            {admin ? "Staff workspace" : "Personal workspace"}
          </div>
        )}
        <nav
          aria-label="Workspace"
          className="workspace-nav min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-1"
        >
          {links.map(([href, label, Icon]) => {
            const active =
              pathname === href ||
              (href !== "/dashboard" && href !== "/admin" && pathname.startsWith(href + "/"));
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset",
                  collapsed && "justify-center px-0",
                  active
                    ? "bg-primary/[0.07] text-foreground"
                    : "text-muted-foreground hover:bg-overlay/60 hover:text-foreground",
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-primary"
                  />
                )}
                <Icon
                  size={18}
                  strokeWidth={1.6}
                  className={cn("shrink-0", active && "text-primary")}
                />
                {!collapsed && label}
                {label === "Notifications" && !collapsed && unread > 0 && (
                  <span className="ml-auto grid min-w-5 place-items-center rounded-md bg-primary/10 px-1 text-xs leading-5 text-primary">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        {!collapsed && (
          <div className="mx-6 mt-3 shrink-0 border-t border-border pt-3">
            <p className="text-xs font-medium leading-4 text-muted-foreground">
              A clear record. At every step.
            </p>
            <p className="mt-1 text-xs leading-4 text-low">Your plots and records</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className={cn(
            "mx-3 my-2 flex h-9 shrink-0 items-center gap-3 rounded-lg px-3 text-xs text-muted-foreground transition-colors hover:bg-overlay/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <PanelLeft size={18} />
          ) : (
            <>
              <PanelLeftClose size={18} />
              Collapse sidebar
            </>
          )}
        </button>
      </aside>
      <div className={cn("transition-all", collapsed ? "lg:pl-20" : "lg:pl-64")}>
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-3 border-b border-border bg-background/90 px-5 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="lg:hidden" aria-label="Dashboard home">
              <Logo size="small" />
            </Link>
            <span className="hidden text-sm text-muted-foreground sm:block">
              Workspace <span className="px-2 text-border">/</span>{" "}
              <span className="text-foreground">
                {pathname === "/dashboard/profile"
                  ? "Profile"
                  : pathname.startsWith("/dashboard/explore/")
                    ? "Plot details"
                    : pathname.startsWith("/dashboard/co-own/start")
                      ? "Start co-ownership"
                      : pathname.includes("/plots/")
                        ? "Plot record"
                        : links.find((l) => l[0] === pathname)?.[1] || "Overview"}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/notifications"
              aria-label={`${unread} unread notifications`}
              className="relative grid size-11 place-items-center rounded-xl hover:bg-overlay"
            >
              <Bell size={18} />
              {unread > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-none text-primary-foreground ring-2 ring-background tabular-nums"
                >
                  {unread}
                </span>
              )}
            </Link>
            <div className="hidden h-7 w-px bg-border sm:block" />
            <Link
              href="/dashboard/profile"
              aria-label="Open profile"
              className="flex min-h-11 items-center gap-3"
            >
              <span className="grid size-9 place-items-center rounded-full border border-gold/25 bg-gold/10 text-xs text-gold">
                {session.name
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <span className="hidden text-xs xl:block">
                {session.name}
                <span className="mt-0.5 block text-low">
                  Profile · {session.staffRole || "Land buyer"}
                </span>
              </span>
            </Link>
            <button
              aria-label="Sign out"
              className="grid size-11 place-items-center text-low"
              onClick={async () => {
                try {
                  await signOut();
                  router.push("/sign-in");
                } catch {
                  toast.error(
                    "We could not sign you out. Please check your connection and try again.",
                  );
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main
          id="main-content"
          className="mx-auto max-w-[1500px] animate-rise px-5 py-8 pb-28 md:px-8 md:py-10"
        >
          {children}
        </main>
        <footer className="px-8 pb-24 text-xs text-low lg:pb-6">
          MIRAI · A technology platform, not an estate agency or investment scheme.
        </footer>
      </div>
      <nav
        aria-label="Mobile workspace"
        className="fixed inset-x-0 bottom-0 z-50 flex justify-around overflow-x-auto border-t border-border bg-card px-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {links.map(([href, label, Icon]) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-h-16 min-w-16 flex-col items-center justify-center gap-1 px-2 text-xs",
              pathname === href ? "text-primary-bright" : "text-muted-foreground",
            )}
          >
            <Icon size={19} />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
