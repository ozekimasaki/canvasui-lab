import { X } from "lucide-react";
import { apiFetch } from "./api";
import { useI18n } from "./i18n";
import { fitCamera, zoomAt, type GpuCanvas as GpuCanvasApi } from "gpucanvas";
import {
  CanvasNode,
  GpuCanvas,
  labelComponent,
  pickComponents,
  useEditor,
  useGpuCanvas,
} from "gpucanvas/react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { DesignTokenData } from "../domain/brands";
import { layoutMatrix, matrixBounds, type MatrixCell } from "../domain/matrix";
import { tokensToCssVars } from "../domain/token";
import { addHumanMark, loadAndDrawMarks, runAudit } from "./auditClient";
import "./app.css";
import { startCommandListener, startStatePublish } from "./bridgeClient";
import { DesignPanel } from "./DesignPanel";
import { InspectorPanel } from "./InspectorPanel";
import { MarksPanel } from "./MarksPanel";
import { applySource, proposeSource } from "./sourceClient";
import { buildSpecs } from "./storiesToSpecs";
import { Toolbar, type ChromeTheme } from "./Toolbar";
import { approveBaseline, captureCellSnapshot, runVrtCheck, type VrtProgress } from "./vrtClient";

const EditorPanel = lazy(() => import("./EditorPanel"));

function EditorBridge({
  trigger,
  onSelect,
  onOpenEditor,
}: {
  trigger: "shift-click" | "click";
  onSelect: (element: Element | null) => void;
  onOpenEditor: (cellKey: string) => void;
}) {
  const canvas = useGpuCanvas();
  const { selected } = useEditor({ pick: pickComponents, label: labelComponent, trigger });
  const selectedRef = useRef<Element | null>(null);
  useEffect(() => {
    const element = selected[0]?.[0] ?? null;
    selectedRef.current = element;
    onSelect(element);
  }, [selected, onSelect]);
  useEffect(() => {
    if (!canvas) return;
    const surface = canvas.surface;
    // gpucanvas has no dblclick hook: a double-click while the component root
    // layer is selected opens the source editor instead of drilling deeper.
    const onDblClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const host = target?.closest?.("[data-cellkey]") ?? null;
      const key = host?.getAttribute("data-cellkey");
      if (key) onOpenEditor(key);
    };
    surface.addEventListener("dblclick", onDblClick);
    return () => surface.removeEventListener("dblclick", onDblClick);
  }, [canvas, onOpenEditor]);
  return null;
}

export function MatrixCanvas({
  appName,
  bridgeToken,
  onOpenDocument,
}: {
  appName: string;
  bridgeToken: string;
  onOpenDocument?: () => void;
}) {
  const { t } = useI18n();
  const { specs, renderCell } = useMemo(buildSpecs, []);
  const cells = useMemo(() => {
    const base = layoutMatrix(specs);
    const bench = Number(new URLSearchParams(window.location.search).get("bench") ?? 0);
    if (!Number.isFinite(bench) || bench <= base.length) return base;
    const bounds = matrixBounds(base);
    const perRow = 40;
    const tiled: MatrixCell[] = [];
    for (let i = 0; i < bench; i++) {
      const src = base[i % base.length];
      const tile = Math.floor(i / base.length);
      tiled.push({
        ...src,
        cellKey: `${src.cellKey}~b${tile}`,
        x: src.x + (tile % perRow) * (bounds.width + 200),
        y: src.y + Math.floor(tile / perRow) * (bounds.height + 200),
      });
    }
    return tiled;
  }, [specs]);
  const [canvas, setCanvas] = useState<GpuCanvasApi | null>(null);
  const [tokens, setTokens] = useState<DesignTokenData[]>([]);
  const [selectedCell, setSelectedCell] = useState<MatrixCell | null>(null);
  const [selectedElement, setSelectedElement] = useState<Element | null>(null);
  const [interact, setInteract] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<VrtProgress | null>(null);
  const [status, setStatus] = useState("");
  const [changedCount, setChangedCount] = useState<number | null>(null);
  const [chrome, setChrome] = useState<ChromeTheme>("system");
  const [editorFile, setEditorFile] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [runs, setRuns] = useState<{ id: string; createdAt: string }[]>([]);
  const [runDetail, setRunDetail] = useState<{ id: string; changed: number } | null>(null);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const resolved = chrome === "system" ? (systemDark ? "dark" : "light") : chrome;
    if (chrome === "system") document.documentElement.removeAttribute("data-chrome");
    else document.documentElement.setAttribute("data-chrome", chrome);
    canvas?.setBackground(resolved === "dark" ? "#0b0d10" : "#f4f5f7");
  }, [chrome, systemDark, canvas]);

  useEffect(() => {
    apiFetch("/api/tokens")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => setTokens(rows as DesignTokenData[]))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    apiFetch("/api/components", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ specs }),
    }).catch(() => undefined);
  }, [specs]);

  useEffect(() => {
    if (canvas) void loadAndDrawMarks(canvas, cells).catch(() => undefined);
  }, [canvas, cells]);

  useEffect(() => {
    canvas?.invalidate();
  }, [tokens, canvas]);

  useEffect(() => {
    if (!canvas) return;
    return startStatePublish(canvas, cells, bridgeToken);
  }, [canvas, cells, bridgeToken]);

  useEffect(() => {
    if (!canvas) return;
    return startCommandListener(canvas, cells, bridgeToken, {
      snapshot: (cellKey, scale) => {
        const cell = cells.find((candidate) => candidate.cellKey === cellKey);
        if (!cell) throw new Error(`unknown cell: ${cellKey}`);
        return captureCellSnapshot(canvas, cell, scale);
      },
      vrt: (cellKeys) =>
        runVrtCheck(canvas, cellKeys ? cells.filter((c) => cellKeys.includes(c.cellKey)) : cells),
      audit: (cellKeys) =>
        runAudit(canvas, cellKeys ? cells.filter((c) => cellKeys.includes(c.cellKey)) : cells),
    });
  }, [canvas, cells, bridgeToken]);

  const cssVarsByTheme = useMemo(() => {
    const themes = new Set(cells.map((cell) => cell.axisValues.theme ?? "light"));
    const map: Record<string, CSSProperties> = {};
    for (const theme of themes) {
      map[theme] = tokensToCssVars(tokens, { mode: theme }) as CSSProperties;
    }
    return map;
  }, [cells, tokens]);

  const handleSelect = useCallback(
    (element: Element | null) => {
      setSelectedElement(element);
      // pickComponents can land on the node wrapper, which is the PARENT of the cell marker.
      const host =
        element?.closest("[data-cellkey]") ?? element?.querySelector("[data-cellkey]") ?? null;
      const key = host?.getAttribute("data-cellkey") ?? null;
      setSelectedCell(key ? (cells.find((cell) => cell.cellKey === key) ?? null) : null);
    },
    [cells],
  );

  const handleOpenEditor = useCallback(
    (cellKey: string) => {
      const cell = cells.find((candidate) => candidate.cellKey === cellKey);
      const spec = specs.find((candidate) => candidate.id === cell?.componentId);
      if (spec) setEditorFile(spec.filePath);
    },
    [cells, specs],
  );

  const handleWriteProp = useCallback(
    async (name: string, rawValue: string) => {
      if (!selectedCell || busy) return;
      const spec = specs.find((candidate) => candidate.id === selectedCell.componentId);
      if (!spec) return;
      const value =
        rawValue === "true"
          ? true
          : rawValue === "false"
            ? false
            : /^-?\d+(\.\d+)?$/.test(rawValue)
              ? Number(rawValue)
              : rawValue;
      setBusy(true);
      try {
        const { patch } = await proposeSource({
          filePath: spec.filePath,
          anchor: { kind: "jsx-attribute", component: spec.title, name, value },
        });
        await applySource(patch, "gui");
        setStatus(t("status.propWritten", { name, file: spec.filePath }));
        canvas?.invalidate();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : t("status.propFailed"));
      } finally {
        setBusy(false);
      }
    },
    [selectedCell, specs, busy, canvas],
  );

  const handleFit = useCallback(() => {
    if (!canvas) return;
    const bounds = matrixBounds(cells);
    const rect = canvas.surface.getBoundingClientRect();
    canvas.setCamera(fitCamera({ x: 0, y: 0, ...bounds }, rect.width, rect.height, 80));
  }, [canvas, cells]);

  const handleZoom = useCallback(
    (factor: number) => {
      if (!canvas) return;
      const rect = canvas.surface.getBoundingClientRect();
      canvas.setCamera(zoomAt(canvas.getCamera(), rect.width / 2, rect.height / 2, factor));
    },
    [canvas],
  );

  const handleVrt = useCallback(async () => {
    if (!canvas || busy) return;
    setBusy(true);
    setStatus(t("status.vrtRunning"));
    setChangedCount(null);
    try {
      const result = await runVrtCheck(canvas, cells, setProgress);
      setChangedCount(result.changedCellKeys.length);
      setStatus(t("status.vrtDone", { count: result.changedCellKeys.length }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("status.vrtFailed"));
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }, [canvas, cells, busy]);

  const handleAudit = useCallback(async () => {
    if (!canvas || busy) return;
    setBusy(true);
    setStatus(t("status.auditRunning"));
    try {
      const result = await runAudit(canvas, cells);
      setStatus(t("status.auditDone", { count: result.count }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("status.auditFailed"));
    } finally {
      setBusy(false);
    }
  }, [canvas, cells, busy]);

  const handleApprove = useCallback(async () => {
    if (!canvas || !selectedCell || busy) return;
    setBusy(true);
    try {
      await approveBaseline(canvas, selectedCell);
      setStatus(t("status.baseline", { key: selectedCell.cellKey }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("status.baselineFailed"));
    } finally {
      setBusy(false);
    }
  }, [canvas, selectedCell, busy]);

  const handleNote = useCallback(
    async (text: string, severity: "info" | "warning" | "error") => {
      if (!canvas || !selectedCell) return;
      try {
        await addHumanMark(canvas, selectedCell.cellKey, selectedElement, text, severity);
        setStatus(t("status.notePinned"));
      } catch (error) {
        setStatus(error instanceof Error ? error.message : t("status.noteFailed"));
      }
    },
    [canvas, selectedCell, selectedElement],
  );

  return (
    <div className="cul-app">
      <GpuCanvas
        style={{ width: "100%", height: "100%" }}
        onReady={(ready) => {
          (window as Window & { __cul?: { canvas: GpuCanvasApi } }).__cul = { canvas: ready };
          setCanvas(ready);
        }}
      >
        <EditorBridge
          trigger={interact ? "shift-click" : "click"}
          onSelect={handleSelect}
          onOpenEditor={handleOpenEditor}
        />
        {cells.map((cell) => {
          const theme = cell.axisValues.theme ?? "light";
          const axisLabel = Object.entries(cell.axisValues)
            .filter(([axis]) => axis !== "theme")
            .map(([axis, value]) => `${axis}:${value}`)
            .join(" ");
          return (
            <CanvasNode
              key={cell.cellKey}
              x={cell.x}
              y={cell.y}
              width={cell.width}
              height={cell.height}
            >
              <div
                className="cul-cell"
                data-cellkey={cell.cellKey}
                data-theme={theme}
                style={cssVarsByTheme[theme]}
              >
                <span className="cul-cell-label">
                  {cell.componentId} · {axisLabel}
                </span>
                {renderCell(cell)}
              </div>
            </CanvasNode>
          );
        })}
      </GpuCanvas>

      <Toolbar
        appName={appName}
        mode={canvas?.mode ?? null}
        interact={interact}
        busy={busy}
        progress={progress}
        status={status}
        changedCount={changedCount}
        cellCount={cells.length}
        chrome={chrome}
        onCycleChrome={() =>
          setChrome((current) =>
            current === "system" ? "light" : current === "light" ? "dark" : "system",
          )
        }
        onFit={handleFit}
        onZoomIn={() => handleZoom(1.25)}
        onZoomOut={() => handleZoom(0.8)}
        onToggleInteract={() => setInteract(!interact)}
        onRunVrt={() => void handleVrt()}
        onRunAudit={() => void handleAudit()}
        onOpenDocument={onOpenDocument}
        onHistory={() => {
          setHistoryOpen(true);
          apiFetch("/api/vrt/runs")
            .then((res) => (res.ok ? res.json() : []))
            .then((rows) => setRuns(rows as { id: string; createdAt: string }[]))
            .catch(() => undefined);
        }}
      />

      {selectedCell && (
        <InspectorPanel
          cell={selectedCell}
          busy={busy}
          onApprove={() => void handleApprove()}
          onAddNote={(text, severity) => void handleNote(text, severity)}
          onEditSource={() => handleOpenEditor(selectedCell.cellKey)}
          onWriteProp={(name, value) => void handleWriteProp(name, value)}
          onClose={() => {
            setSelectedCell(null);
            setSelectedElement(null);
          }}
        />
      )}

      {editorFile && (
        <Suspense
          fallback={
            <div
              className="cul-panel"
              style={{ position: "absolute", right: 16, top: 76, padding: 16 }}
            >
              Loading editor…
            </div>
          }
        >
          <EditorPanel
            filePath={editorFile}
            onClose={() => setEditorFile(null)}
            onApplied={(message) => {
              setStatus(message);
              canvas?.invalidate();
            }}
          />
        </Suspense>
      )}

      {historyOpen && (
        <div
          className="cul-panel"
          style={{
            position: "absolute",
            left: 16,
            top: 76,
            width: 320,
            maxHeight: "60vh",
            overflow: "auto",
            zIndex: 25,
          }}
        >
          <div className="cul-panel-header">
            <span>{t("toolbar.history")}</span>
            <button
              className="cul-icon-btn"
              style={{ marginLeft: "auto" }}
              onClick={() => setHistoryOpen(false)}
              aria-label={t("design.close")}
            >
              <X size={14} />
            </button>
          </div>
          <div style={{ padding: 8, display: "grid", gap: 4 }}>
            {runs.length === 0 && (
              <p className="cul-hint" style={{ margin: 0 }}>
                —
              </p>
            )}
            {runs.map((run) => (
              <button
                key={run.id}
                className="cul-btn"
                style={{ fontSize: 11, justifyContent: "space-between" }}
                onClick={() => {
                  apiFetch(`/api/vrt/runs/${run.id}`)
                    .then((res) => (res.ok ? res.json() : []))
                    .then((rows) =>
                      setRunDetail({
                        id: run.id,
                        changed: (rows as { changed: boolean }[]).filter((r) => r.changed).length,
                      }),
                    )
                    .catch(() => undefined);
                }}
              >
                <span>{run.createdAt}</span>
                <span>{runDetail?.id === run.id ? `${runDetail.changed} changed` : ""}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <DesignPanel canvas={canvas} cells={cells} />
      <MarksPanel canvas={canvas} />
    </div>
  );
}
