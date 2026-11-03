"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/session";
import {
  authenticatedRequest,
  type BuyerNotification,
  type NotificationPage,
} from "@/lib/announcement-api";

type Inbox = NotificationPage & {
  loading: boolean;
  loadingMore: boolean;
  error: string;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};
const empty: NotificationPage = { items: [], unreadCount: 0, nextCursor: null };
const Context = createContext<Inbox>({
  ...empty,
  loading: false,
  loadingMore: false,
  error: "",
  refresh: async () => {},
  loadMore: async () => {},
  markRead: async () => {},
  markAllRead: async () => {},
});

export function BuyerNotificationsProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  const userId = pathname.startsWith("/dashboard") ? session?.id : undefined;
  const [state, setState] = useState<NotificationPage & { userId?: string }>(empty);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const activeUser = useRef(userId);
  const requestVersion = useRef(0);
  const paging = useRef(false);
  const hasMorePages = useRef(false);
  const refreshing = useRef(false);
  const current = state.userId === userId ? state : empty;

  const refresh = useCallback(async () => {
    if (!userId || refreshing.current) return;
    refreshing.current = true;
    const version = requestVersion.current;
    try {
      const page = await authenticatedRequest<NotificationPage>("/notifications");
      if (activeUser.current !== userId || version !== requestVersion.current) return;
      setState((previous) => {
        if (!hasMorePages.current || previous.userId !== userId) return { ...page, userId };
        const fresh = new Map(page.items.map((item) => [item.id, item]));
        return {
          ...page,
          userId,
          nextCursor: previous.nextCursor,
          items: [...page.items, ...previous.items.filter((item) => !fresh.has(item.id))],
        };
      });
      setError("");
    } catch (e) {
      if (activeUser.current === userId)
        setError(e instanceof Error ? e.message : "Could not load notifications.");
    } finally {
      if (activeUser.current === userId) {
        refreshing.current = false;
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    activeUser.current = userId;
    requestVersion.current++;
    hasMorePages.current = false;
    refreshing.current = false;
    paging.current = false;
    setState(empty);
    setError("");
    setLoading(Boolean(userId));
    if (!userId) return;
    void refresh();
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    const timer = setInterval(visible, 30000);
    return () => {
      activeUser.current = undefined;
      clearInterval(timer);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [userId, refresh]);

  async function loadMore() {
    if (!userId || !current.nextCursor || paging.current) return;
    paging.current = true;
    setLoadingMore(true);
    try {
      const page = await authenticatedRequest<NotificationPage>(
        `/notifications?cursor=${encodeURIComponent(current.nextCursor)}`,
      );
      if (activeUser.current !== userId) return;
      hasMorePages.current = true;
      setState((previous) => ({
        ...page,
        userId,
        items: [
          ...previous.items,
          ...page.items.filter((item) => !previous.items.some((old) => old.id === item.id)),
        ],
      }));
      setError("");
    } catch (e) {
      if (activeUser.current === userId)
        setError(e instanceof Error ? e.message : "Could not load more notifications.");
    } finally {
      paging.current = false;
      setLoadingMore(false);
    }
  }

  async function markRead(id: string) {
    const result = await authenticatedRequest<{
      notification: BuyerNotification;
      unreadCount: number;
    }>(`/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
    if (activeUser.current !== userId) return;
    requestVersion.current++;
    setState((previous) => ({
      ...previous,
      unreadCount: result.unreadCount,
      items: previous.items.map((item) => (item.id === id ? result.notification : item)),
    }));
  }
  async function markAllRead() {
    const result = await authenticatedRequest<{ unreadCount: number }>("/notifications/read-all", {
      method: "POST",
    });
    if (activeUser.current !== userId) return;
    requestVersion.current++;
    setState((previous) => ({
      ...previous,
      unreadCount: result.unreadCount,
      items: previous.items.map((item) => ({
        ...item,
        readAt: item.readAt ?? new Date().toISOString(),
      })),
    }));
  }
  return (
    <Context.Provider
      value={{ ...current, loading, loadingMore, error, refresh, loadMore, markRead, markAllRead }}
    >
      {children}
    </Context.Provider>
  );
}
export function useBuyerNotifications() {
  return useContext(Context);
}
