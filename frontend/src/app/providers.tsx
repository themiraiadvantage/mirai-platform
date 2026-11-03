"use client";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ScrollProgress } from "@/components/mirai/SiteChrome";
import { initializeSession, syncSignedOutTab } from "@/lib/session";
import { BuyerNotificationsProvider } from "@/components/mirai/BuyerNotifications";
import { SavedPlotsProvider } from "@/components/mirai/SavedPlots";
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void initializeSession();
    window.addEventListener("storage", syncSignedOutTab);
    // Remove preferences left by the retired appearance switcher.
    document.documentElement.classList.remove("light", "dark", "forest");
    document.documentElement.style.colorScheme = "light";
    try {
      localStorage.removeItem("mirai-theme");
      localStorage.removeItem("mirai-palette");
    } catch {
      /* The fixed palette does not require browser storage. */
    }
    return () => window.removeEventListener("storage", syncSignedOutTab);
  }, []);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <ScrollProgress />
      <BuyerNotificationsProvider>
        <SavedPlotsProvider>{children}</SavedPlotsProvider>
      </BuyerNotificationsProvider>
      <Toaster position="bottom-right" theme="light" />
    </>
  );
}
