import { Logo } from "./primitives";

export function WorkspaceLoading({
  title = "Opening your workspace",
  description = "Getting everything ready for you.",
  fullScreen = true,
}: {
  title?: string;
  description?: string;
  fullScreen?: boolean;
}) {
  return (
    <div className={`workspace-loading${fullScreen ? "" : " workspace-loading-inline"}`}>
      <div className="workspace-loading-content" role="status" aria-live="polite" aria-busy="true">
        <Logo className="workspace-loading-brand" size="large" />
        <div className="workspace-loading-indicator" aria-hidden="true">
          <span className="workspace-loading-orbit" />
          <span className="workspace-loading-core" />
        </div>
        <h2>{title}</h2>
        <p>{description}</p>
        <span className="workspace-loading-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  );
}
