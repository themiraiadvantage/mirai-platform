"use client";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Bookmark, LoaderCircle } from "lucide-react";
import { useSession } from "@/lib/session";
import { authenticatedRequest } from "@/lib/announcement-api";
import { post } from "@/lib/property-api";
import { authHref } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Context = createContext({
  ids: [] as string[],
  loading: false,
  error: "",
  busy: [] as string[],
  revision: 0,
  refresh: async () => {},
  setSaved: async (_id: string, _saved: boolean) => {},
});
export const useSavedPlots = () => useContext(Context);
export function SavedPlotsProvider({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const userId = session && !session.staffRole ? session.id : undefined;
  const active = useRef(userId);
  active.current = userId;
  const version = useRef(0);
  const pending = useRef(new Set<string>());
  const [state, setState] = useState({
    userId,
    ids: [] as string[],
    loading: !!userId,
    error: "",
    busy: [] as string[],
    revision: 0,
  });
  const refresh = useCallback(async () => {
    if (!userId) return;
    const request = ++version.current;
    try {
      const result = await authenticatedRequest<{ ids: string[] }>("/saved-plots/ids");
      if (active.current === userId && version.current === request)
        setState((s) => ({
          ...s,
          userId,
          ids: result.ids,
          loading: false,
          error: "",
          revision: s.revision + 1,
        }));
    } catch (e) {
      if (active.current === userId && version.current === request)
        setState((s) => ({
          ...s,
          userId,
          loading: false,
          error: e instanceof Error ? e.message : "Could not load saved plots.",
        }));
    }
  }, [userId]);
  useEffect(() => {
    version.current++;
    pending.current.clear();
    setState({ userId, ids: [], loading: !!userId, error: "", busy: [], revision: 0 });
    void refresh();
    const focused = () => {
      void refresh();
    };
    window.addEventListener("focus", focused);
    return () => {
      version.current++;
      window.removeEventListener("focus", focused);
    };
  }, [userId, refresh]);
  async function setSaved(plotId: string, saved: boolean) {
    if (!userId || pending.current.has(plotId)) return;
    pending.current.add(plotId);
    version.current++;
    setState((s) => ({ ...s, busy: [...pending.current] }));
    try {
      await post("/saved-plots", { plotId, saved });
      if (active.current !== userId) return;
      version.current++;
      setState((s) => ({
        ...s,
        ids: saved ? [...new Set([...s.ids, plotId])] : s.ids.filter((id) => id !== plotId),
        revision: s.revision + 1,
      }));
    } finally {
      if (active.current === userId) {
        pending.current.delete(plotId);
        setState((s) => ({ ...s, busy: [...pending.current] }));
      }
    }
  }
  const current =
    state.userId === userId ? state : { ...state, ids: [], busy: [], loading: !!userId, error: "" };
  return <Context.Provider value={{ ...current, refresh, setSaved }}>{children}</Context.Provider>;
}
export function SavePlotButton({
  plotId,
  code,
  className = "",
  iconOnly = false,
}: {
  plotId: string;
  code: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const session = useSession();
  const saved = useSavedPlots();
  if (session?.staffRole) return null;
  const selected = saved.ids.includes(plotId);
  const busy = saved.busy.includes(plotId);
  const label = selected ? "Unsave plot" : "Save plot";
  if (!session)
    return (
      <Button variant="outline" className={className} size={iconOnly ? "icon" : "default"} asChild>
        <Link
          href={authHref("/sign-in", `/dashboard/explore/${code}`)}
          aria-label="Sign in to save plot"
        >
          <Bookmark size={17} />
          {!iconOnly && "Sign in to save"}
        </Link>
      </Button>
    );
  return (
    <Button
      variant="outline"
      className={className}
      size={iconOnly ? "icon" : "default"}
      aria-label={label}
      aria-pressed={selected}
      disabled={saved.loading || busy}
      title={label}
      onClick={() => {
        if (saved.error) {
          toast.error(saved.error);
          void saved.refresh();
          return;
        }
        void saved
          .setSaved(plotId, !selected)
          .then(() =>
            toast.success(
              selected ? "Plot removed from saved plots" : "Plot saved to your Land Library",
            ),
          )
          .catch((e) => toast.error(e instanceof Error ? e.message : "Could not save this plot."));
      }}
    >
      {busy || saved.loading ? (
        <LoaderCircle size={17} className="animate-spin" />
      ) : (
        <Bookmark size={17} className={selected ? "fill-current text-amber-800" : ""} />
      )}
      {!iconOnly && (selected ? "Saved plot" : "Save plot")}
    </Button>
  );
}
