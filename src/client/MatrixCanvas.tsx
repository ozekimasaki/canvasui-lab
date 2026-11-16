import { fitCamera, zoomAt, type GpuCanvas as GpuCanvasApi } from "gpucanvas";
import { CanvasNode, GpuCanvas, labelComponent, pickComponents, useEditor } from "gpucanvas/react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { DesignTokenData } from "../domain/brands";
import { layoutMatrix, matrixBounds, type MatrixCell } from "../domain/matrix";
import { tokensToCssVars } from "../domain/token";
import { addHumanMark, loadAndDrawMarks, runAudit } from "./auditClient";
import "./app.css";
import { DesignPanel } from "./DesignPanel";
import { InspectorPanel } from "./InspectorPanel";
import { MarksPanel } from "./MarksPanel";
import { buildSpecs } from "./storiesToSpecs";
import { Toolbar, type ChromeTheme } from "./Toolbar";
import { approveBaseline, runVrtCheck, type VrtProgress } from "./vrtClient";

function EditorBridge({
  trigger,
  onSelect,
}: {
  trigger: "shift-click" | "click";
  onSelect: (element: Element | null) => void;
}) {
  const { selected } = useEditor({ pick: pickComponents, label: labelComponent, trigger });
  useEffect(() => {
    onSelect(selected[0]?.[0] ?? null);
  }, [selected, onSelect]);
  return null;
}

export function MatrixCanvas({ appName }: { appName: string }) {
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
    fetch("/api/tokens")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => setTokens(rows as DesignTokenData[]))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/components", {
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
    setStatus("Running VRT…");
    setChangedCount(null);
    try {
      const result = await runVrtCheck(canvas, cells, setProgress);
      setChangedCount(result.changedCellKeys.length);
      setStatus(`VRT complete: ${result.changedCellKeys.length} changed`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "VRT failed");
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }, [canvas, cells, busy]);

  const handleAudit = useCallback(async () => {
    if (!canvas || busy) return;
    setBusy(true);
    setStatus("Auditing (max 20 cells)…");
    try {
      const result = await runAudit(canvas, cells);
      setStatus(`Audit complete: ${result.count} marks`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Audit failed");
    } finally {
      setBusy(false);
    }
  }, [canvas, cells, busy]);

  const handleApprove = useCallback(async () => {
    if (!canvas || !selectedCell || busy) return;
    setBusy(true);
    try {
      await approveBaseline(canvas, selectedCell);
      setStatus(`Baseline approved: ${selectedCell.cellKey}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Baseline capture failed");
    } finally {
      setBusy(false);
    }
  }, [canvas, selectedCell, busy]);

  const handleNote = useCallback(
    async (text: string, severity: "info" | "warning" | "error") => {
      if (!canvas || !selectedCell) return;
      try {
        await addHumanMark(canvas, selectedCell.cellKey, selectedElement, text, severity);
        setStatus("Note pinned");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Note failed");
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
        <EditorBridge trigger={interact ? "shift-click" : "click"} onSelect={handleSelect} />
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
      />

      {selectedCell && (
        <InspectorPanel
          cell={selectedCell}
          busy={busy}
          onApprove={() => void handleApprove()}
          onAddNote={(text, severity) => void handleNote(text, severity)}
          onClose={() => {
            setSelectedCell(null);
            setSelectedElement(null);
          }}
        />
      )}

      <DesignPanel canvas={canvas} cells={cells} />
      <MarksPanel canvas={canvas} />
    </div>
  );
}
