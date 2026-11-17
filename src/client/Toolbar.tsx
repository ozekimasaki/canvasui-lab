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
import { useI18n } from "./i18n";

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
  onOpenDocument?: () => void;
  onHistory?: () => void;
}

export function Toolbar(props: ToolbarProps) {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="cul-toolbar">
      <strong className="cul-title">{props.appName}</strong>
      {props.onOpenDocument && (
        <button className="cul-btn" onClick={props.onOpenDocument} title={t("mode.document.tip")}>
          {t("mode.document")}
        </button>
      )}
      <span className={props.mode === "gpu" ? "cul-badge cul-badge-gpu" : "cul-badge"}>
        {props.mode === "gpu"
          ? "GPU"
          : props.mode === "dom"
            ? t("toolbar.dom")
            : t("toolbar.starting")}
      </span>
      <span className="cul-hint">{t("cells", { count: props.cellCount })}</span>

      <div className="cul-toolbar-group">
        <button
          className="cul-icon-btn"
          onClick={props.onCycleChrome}
          aria-label={t("toolbar.theme", { chrome: props.chrome })}
          title={t("toolbar.theme", { chrome: props.chrome })}
        >
          {props.chrome === "system" ? (
            <Monitor size={14} />
          ) : props.chrome === "light" ? (
            <Sun size={14} />
          ) : (
            <Moon size={14} />
          )}
        </button>
        <button
          className="cul-icon-btn"
          onClick={props.onFit}
          aria-label={t("toolbar.fit")}
          title={t("toolbar.fit")}
        >
          <Maximize size={14} />
        </button>
        <button
          className="cul-icon-btn"
          onClick={props.onZoomIn}
          aria-label={t("toolbar.zoomIn")}
          title={t("toolbar.zoomIn")}
        >
          <ZoomIn size={14} />
        </button>
        <button
          className="cul-icon-btn"
          onClick={props.onZoomOut}
          aria-label={t("toolbar.zoomOut")}
          title={t("toolbar.zoomOut")}
        >
          <ZoomOut size={14} />
        </button>
        <button className="cul-btn" onClick={props.onToggleInteract}>
          <MousePointer2 size={12} />
          {props.interact ? t("toolbar.interact") : t("toolbar.edit")}
        </button>
      </div>

      <div className="cul-toolbar-group">
        <button
          className="cul-btn cul-btn-primary"
          onClick={props.onRunVrt}
          disabled={props.busy}
          title={props.busy ? t("toolbar.busy") : t("toolbar.vrt")}
        >
          <Play size={12} /> {t("toolbar.vrt")}
        </button>
        <button
          className="cul-btn"
          onClick={props.onRunAudit}
          disabled={props.busy}
          title={props.busy ? t("toolbar.busy") : t("toolbar.audit")}
        >
          <ScanSearch size={12} /> {t("toolbar.audit")}
        </button>
        <button className="cul-btn" onClick={props.onHistory}>
          <History size={12} /> {t("toolbar.history")}
        </button>
        <button className="cul-btn" onClick={() => setLang(lang === "ja" ? "en" : "ja")}>
          {t("lang.toggle")}
        </button>
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
          {props.changedCount > 0
            ? t("toolbar.changed", { count: props.changedCount })
            : t("toolbar.clean")}
        </span>
      )}
      {props.status && <span className="cul-status">{props.status}</span>}
    </div>
  );
}
