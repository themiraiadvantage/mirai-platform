import type { ReactNode } from "react";
import { Logo } from "@/components/mirai/primitives";
import { WorkspaceLoading } from "@/components/mirai/WorkspaceLoading";

// Keep the workspace frame visible while the first authenticated session loads.
// Account details and navigation permissions appear only after verification.
export function AdminStartup({ children }: { children?: ReactNode }) {
  return (
    <div className="admin-app">
      <aside className="admin-sidebar" aria-label="Admin navigation loading">
        <div className="admin-brand">
          <Logo dark />
          <span>ADMIN</span>
        </div>
        <div className="admin-workspace-label">MIRAI workspace</div>
        <div className="admin-navigation" aria-hidden="true">
          <div className="admin-navigation-skeleton">
            {Array.from({ length: 9 }, (_, index) => (
              <span key={index} />
            ))}
          </div>
        </div>
      </aside>
      <div className="admin-main-wrap">
        <header className="admin-topbar">
          <span className="admin-breadcrumb">MIRAI Admin</span>
        </header>
        <main id="main-content" className="admin-content">
          {children ?? <WorkspaceLoading title="Opening MIRAI Admin" fullScreen={false} />}
        </main>
      </div>
    </div>
  );
}
