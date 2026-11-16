import {
  History,
  Maximize,
  Monitor,
  Moon,
  MousePointer2,
  Play,
  ScanSearch,
  Sun,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

export type ChromeTheme = "system" | "light" | "dark";

export interface ToolbarProps {
  appName: string;
  mode: "gpu" | "dom" | null;
  interact: boolean;
  busy: boolean;
  progress: { done: number; total: number; phase: string } | null;
  status: string;
  changedCount: number | null;
  cellCount: number;
  chrome: ChromeTheme;
  onCycleChrome: () => void;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleInteract: () => void;
  onRunVrt: () => void;
  onRunAudit: () => void;
}

export function Toolbar(props: ToolbarProps) {
  return (
    <div className="cul-toolbar">
      <strong className="cul-title">{props.appName}</strong>
      <span className={props.mode === "gpu" ? "cul-badge cul-badge-gpu" : "cul-badge"}>
        {props.mode === "gpu" ? "GPU" : props.mode === "dom" ? "DOM fallback" : "starting"}
      </span>
      <span className="cul-hint">{props.cellCount} cells</span>

      <div className="cul-toolbar-group">
        <button
          className="cul-icon-btn"
          onClick={props.onCycleChrome}
          aria-label="Color theme"
          title={`Theme: ${props.chrome}`}
        >
          {props.chrome === "system" ? (
            <Monitor size={14} />
          ) : props.chrome === "light" ? (
            <Sun size={14} />
          ) : (
            <Moon size={14} />
          )}
        </button>
        <button className="cul-icon-btn" onClick={props.onFit} aria-label="Fit view">
          <Maximize size={14} />
        </button>
        <button className="cul-icon-btn" onClick={props.onZoomIn} aria-label="Zoom in">
          <ZoomIn size={14} />
        </button>
        <button className="cul-icon-btn" onClick={props.onZoomOut} aria-label="Zoom out">
          <ZoomOut size={14} />
        </button>
        <button className="cul-btn" onClick={props.onToggleInteract}>
          <MousePointer2 size={12} />
          {props.interact ? "Interact" : "Edit"}
        </button>
      </div>

      <div className="cul-toolbar-group">
        <button className="cul-btn cul-btn-primary" onClick={props.onRunVrt} disabled={props.busy}>
          <Play size={12} /> Run VRT
        </button>
        <button className="cul-btn" onClick={props.onRunAudit} disabled={props.busy}>
          <ScanSearch size={12} /> Audit
        </button>
        <a className="cul-btn" href="/history">
          <History size={12} /> History
        </a>
      </div>

      {props.progress && (
        <span className="cul-hint">
          {props.progress.phase} {props.progress.done}/{props.progress.total}
        </span>
      )}
      {props.changedCount !== null && (
        <span
          className={
            props.changedCount > 0 ? "cul-badge cul-badge-bad" : "cul-badge cul-badge-good"
          }
        >
          {props.changedCount > 0 ? `${props.changedCount} changed` : "clean"}
        </span>
      )}
      {props.status && <span className="cul-status">{props.status}</span>}
    </div>
  );
}
