import {
  Bot,
  Maximize,
  Monitor,
  Moon,
  Redo2,
  Sun,
  Undo2,
  Wifi,
  WifiOff,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useI18n } from "./i18n";
import { useTabs } from "./useTabs";
import type { ChromeTheme } from "./Toolbar";

export function TopBar({
  appName,
  mode,
  setMode,
  docName,
  onRename,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onFit,
  onZoom100,
  onZoomIn,
  onZoomOut,
  onChat,
  chrome,
  onCycleChrome,
  syncEnabled,
  onToggleSync,
}: {
  appName: string;
  mode: "document" | "catalog";
  setMode: (m: "document" | "catalog") => void;
  docName: string;
  onRename: (name: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onFit: () => void;
  onZoom100: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onChat: () => void;
  chrome: ChromeTheme;
  onCycleChrome: () => void;
  syncEnabled: boolean;
  onToggleSync: () => void;
}) {
  const { t, lang, setLang } = useI18n();
  const modeTabs = useTabs(["document", "catalog"] as const, mode, setMode);
  return (
    <div
      className="cul-toolbar"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 48,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 12px",
      }}
    >
      <strong className="cul-title">{appName}</strong>
      <input
        className="cul-input-field"
        style={{ width: 140, fontSize: 12, padding: "3px 8px" }}
        defaultValue={docName}
        key={docName}
        onBlur={(e) => e.target.value && e.target.value !== docName && onRename(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        aria-label={t("topbar.docName")}
      />
      <div
        role="tablist"
        style={{
          display: "flex",
          border: "1px solid var(--cul-border, #e2e4e8)",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        {(["document", "catalog"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            tabIndex={mode === m ? 0 : -1}
            title={t(m === "document" ? "mode.document.tip" : "mode.catalog.tip")}
            onClick={() => setMode(m)}
            style={{
              border: "none",
              padding: "4px 12px",
              fontSize: 12,
              cursor: "pointer",
              background: mode === m ? "var(--cul-accent)" : "transparent",
              color: mode === m ? "#fff" : "inherit",
            }}
          >
            {t(m === "document" ? "mode.document" : "mode.catalog")}
          </button>
        ))}
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
        <button
          className="cul-icon-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title={t("undo")}
          aria-label={t("undo")}
        >
          <Undo2 size={14} />
        </button>
        <button
          className="cul-icon-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title={t("redo")}
          aria-label={t("redo")}
        >
          <Redo2 size={14} />
        </button>
        <span style={{ width: 1, height: 16, background: "var(--cul-border, #e2e4e8)" }} />
        <button className="cul-icon-btn" onClick={onZoomOut} aria-label={t("topbar.zoomOut")}>
          <ZoomOut size={14} />
        </button>
        <button className="cul-btn" onClick={onZoom100} title={t("zoom100")}>
          {Math.round(zoom * 100)}%
        </button>
        <button className="cul-icon-btn" onClick={onZoomIn} aria-label={t("topbar.zoomIn")}>
          <ZoomIn size={14} />
        </button>
        <button className="cul-icon-btn" onClick={onFit} title={t("fit")} aria-label={t("fit")}>
          <Maximize size={14} />
        </button>
        <span style={{ width: 1, height: 16, background: "var(--cul-border, #e2e4e8)" }} />
        <button className="cul-btn" onClick={onChat} title={t("ai.open")}>
          <Bot size={13} /> AI
        </button>
        <button
          className="cul-icon-btn"
          onClick={onToggleSync}
          title={t("status.sync")}
          aria-pressed={syncEnabled}
          style={syncEnabled ? { color: "var(--cul-accent)" } : undefined}
        >
          {syncEnabled ? <Wifi size={14} /> : <WifiOff size={14} />}
        </button>
        <button
          className="cul-icon-btn"
          onClick={onCycleChrome}
          title={`Theme: ${chrome}`}
          aria-label={t("topbar.theme")}
        >
          {chrome === "system" ? (
            <Monitor size={14} />
          ) : chrome === "light" ? (
            <Sun size={14} />
          ) : (
            <Moon size={14} />
          )}
        </button>
        <button className="cul-btn" onClick={() => setLang(lang === "ja" ? "en" : "ja")}>
          {t("lang.toggle")}
        </button>
      </div>
    </div>
  );
}
