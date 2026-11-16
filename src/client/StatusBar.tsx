import type { GpuCanvas as GpuCanvasApi } from "gpucanvas";
import { useI18n } from "./i18n";

export function StatusBar({
  selectionCount,
  zoom,
  canvas,
  saveState,
  syncEnabled,
}: {
  selectionCount: number;
  zoom: number;
  canvas: GpuCanvasApi | null;
  saveState: "saved" | "saving";
  syncEnabled: boolean;
}) {
  const { t } = useI18n();
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 24,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 12px",
        fontSize: 11,
        color: "var(--cul-muted, #8a8f98)",
        background: "var(--cul-surface, #fff)",
        borderTop: "1px solid var(--cul-border, #e2e4e8)",
        zIndex: 30,
      }}
    >
      <span>
        {selectionCount} {t("status.selection")}
      </span>
      <span>{Math.round(zoom * 100)}%</span>
      <span
        className={canvas?.mode === "gpu" ? "cul-badge cul-badge-gpu" : "cul-badge"}
        style={{ fontSize: 10, padding: "0 6px" }}
      >
        {canvas?.mode === "gpu" ? t("status.gpu") : t("status.dom")}
      </span>
      <span>{syncEnabled ? t("status.sync") : t("status.offline")}</span>
      <span style={{ marginLeft: "auto" }}>
        {saveState === "saved" ? t("status.saved") : t("status.saving")}
      </span>
    </div>
  );
}
