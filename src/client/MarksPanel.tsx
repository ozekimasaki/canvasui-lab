import { apiFetch } from "./api";
import { Bot, ChevronDown, MapPin, RefreshCw, StickyNote, Trash2, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { GpuCanvas } from "gpucanvas";
import { loadAndDrawMarks, removeDrawing, type MarkRow } from "./auditClient";
import { useI18n } from "./i18n";

const SEVERITY_COLORS: Record<string, string> = {
  info: "#3b82f6",
  warning: "#f59e0b",
  error: "#ef4444",
};

export function MarksPanel({ canvas }: { canvas: GpuCanvas | null }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);
  const [marks, setMarks] = useState<MarkRow[]>([]);

  const refresh = useCallback(async () => {
    const res = await apiFetch("/api/marks");
    if (res.ok) setMarks((await res.json()) as MarkRow[]);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = async (id: string) => {
    await apiFetch(`/api/marks/${id}`, { method: "DELETE" });
    if (canvas) removeDrawing(canvas, id);
    await refresh();
  };

  const clearAi = async () => {
    await apiFetch("/api/marks/clear-ai", { method: "POST" });
    if (canvas) await loadAndDrawMarks(canvas);
    await refresh();
  };

  return (
    <div className="cul-panel" style={{ position: "absolute", right: 16, bottom: 16, width: 320 }}>
      <button className="cul-panel-header" onClick={() => setOpen(!open)}>
        <MapPin size={14} />
        <span>{t("marks.title")}</span>
        <span className="cul-badge">{marks.length}</span>
        <ChevronDown
          size={14}
          style={{ marginLeft: "auto", transform: open ? "none" : "rotate(-90deg)" }}
        />
      </button>
      {open && (
        <div className="cul-panel-body">
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button className="cul-btn" onClick={() => void refresh()}>
              <RefreshCw size={12} /> Refresh
            </button>
            <button className="cul-btn" onClick={() => void clearAi()}>
              <Bot size={12} /> Clear AI
            </button>
          </div>
          <p className="cul-hint">{t("marks.cap")}</p>
          {marks.length === 0 && <p className="cul-hint">{t("marks.empty")}</p>}
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: 8,
              maxHeight: 260,
              overflowY: "auto",
            }}
          >
            {marks.map((mark) => (
              <li key={mark.id} className="cul-mark-row">
                <span
                  className="cul-dot"
                  style={{ background: SEVERITY_COLORS[mark.severity] ?? SEVERITY_COLORS.info }}
                />
                {mark.kind === "note" ? <StickyNote size={12} /> : <MapPin size={12} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.4 }}>{mark.text}</p>
                  <p
                    className="cul-hint"
                    style={{ margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    {mark.author === "ai" ? <Bot size={10} /> : <User size={10} />}
                    {mark.cellKey.length > 28 ? `${mark.cellKey.slice(0, 28)}…` : mark.cellKey}
                  </p>
                </div>
                <button
                  className="cul-icon-btn"
                  onClick={() => void remove(mark.id)}
                  aria-label={t("marks.delete")}
                  title={t("marks.delete")}
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
