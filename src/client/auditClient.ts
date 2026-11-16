import {
  createAgentView,
  createMarks,
  type AgentView,
  type GpuCanvas,
  type Mark,
  type Marks,
} from "gpucanvas";
import type { MatrixCell } from "../domain/matrix";

export interface MarkRow {
  id: string;
  cellKey: string;
  targetElementId: string | null;
  kind: "pin" | "note";
  text: string;
  severity: "info" | "warning" | "error";
  author: "ai" | "human";
  runId: string | null;
}

const SEVERITY_COLORS: Record<MarkRow["severity"], string> = {
  info: "#3b82f6",
  warning: "#f59e0b",
  error: "#ef4444",
};

const views = new WeakMap<GpuCanvas, AgentView>();
const marksApis = new WeakMap<GpuCanvas, Marks>();
const drawnMarks = new WeakMap<GpuCanvas, Map<string, Mark>>();
const cellRects = new WeakMap<
  GpuCanvas,
  Map<string, { x: number; y: number; width: number; height: number }>
>();

function viewFor(canvas: GpuCanvas): AgentView {
  let view = views.get(canvas);
  if (!view) {
    view = createAgentView(canvas);
    views.set(canvas, view);
  }
  return view;
}

function marksFor(canvas: GpuCanvas): Marks {
  let api = marksApis.get(canvas);
  if (!api) {
    api = createMarks(canvas);
    marksApis.set(canvas, api);
  }
  return api;
}

function drawnFor(canvas: GpuCanvas): Map<string, Mark> {
  let map = drawnMarks.get(canvas);
  if (!map) {
    map = new Map();
    drawnMarks.set(canvas, map);
  }
  return map;
}

function rememberRects(canvas: GpuCanvas, cells: readonly MatrixCell[]): void {
  const map = cellRects.get(canvas) ?? new Map();
  for (const cell of cells) {
    map.set(cell.cellKey, { x: cell.x, y: cell.y, width: cell.width, height: cell.height });
  }
  cellRects.set(canvas, map);
}

function drawMark(canvas: GpuCanvas, row: MarkRow, elementOverride?: Element | null): void {
  const api = marksFor(canvas);
  const drawn = drawnFor(canvas);
  drawn.get(row.id)?.remove();

  const element =
    elementOverride ?? (row.targetElementId ? viewFor(canvas).element(row.targetElementId) : null);
  const rect = cellRects.get(canvas)?.get(row.cellKey);
  const point = rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null;
  const color = SEVERITY_COLORS[row.severity] ?? SEVERITY_COLORS.info;
  const label = row.author === "ai" ? "AI" : row.severity;

  let mark: Mark | null = null;
  if (row.kind === "note" && element) {
    mark = api.note(element, row.text, { color });
  } else if (element) {
    mark = api.pin(element, { text: row.text, label, color });
  } else if (point) {
    mark = api.pin(point, { text: row.text, label, color });
  }
  if (mark) drawn.set(row.id, mark);
}

export function removeDrawing(canvas: GpuCanvas, id: string): void {
  const drawn = drawnFor(canvas);
  drawn.get(id)?.remove();
  drawn.delete(id);
}

export async function runAudit(
  canvas: GpuCanvas,
  cells: MatrixCell[],
  diffSummary?: Record<string, { changed: boolean; diffRatio: number }>,
): Promise<{ runId: string; count: number }> {
  const selected = cells.slice(0, 20);
  rememberRects(canvas, selected);
  const view = viewFor(canvas);
  const payload = selected.map((cell) => ({
    cellKey: cell.cellKey,
    componentName: cell.componentId,
    describe: view.describe({
      rect: { x: cell.x, y: cell.y, width: cell.width, height: cell.height },
      depth: 6,
    }),
    diff: diffSummary?.[cell.cellKey],
  }));
  const res = await fetch("/api/audit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cells: payload }),
  });
  const data: unknown = await res.json();
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? typeof data.error === "string"
          ? data.error
          : JSON.stringify(data.error)
        : `Audit failed: ${res.status}`;
    throw new Error(message);
  }
  const result = data as { runId: string; marks: Omit<MarkRow, "id">[] };
  result.marks.forEach((mark, index) => {
    drawMark(canvas, { ...mark, id: `${result.runId}:${index}` });
  });
  return { runId: result.runId, count: result.marks.length };
}

export async function loadAndDrawMarks(canvas: GpuCanvas, cells?: MatrixCell[]): Promise<void> {
  if (cells) rememberRects(canvas, cells);
  const res = await fetch("/api/marks");
  if (!res.ok) return;
  const rows = (await res.json()) as MarkRow[];
  const drawn = drawnFor(canvas);
  for (const mark of drawn.values()) mark.remove();
  drawn.clear();
  for (const row of rows) drawMark(canvas, row);
}

export async function addHumanMark(
  canvas: GpuCanvas,
  cellKey: string,
  target: Element | null,
  text: string,
  severity: MarkRow["severity"],
): Promise<void> {
  const res = await fetch("/api/marks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cellKey, targetElementId: null, kind: "pin", text, severity }),
  });
  const data: unknown = await res.json();
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? typeof data.error === "string"
          ? data.error
          : JSON.stringify(data.error)
        : `Mark failed: ${res.status}`;
    throw new Error(message);
  }
  const result = data as { ids: string[] };
  drawMark(
    canvas,
    {
      id: result.ids[0] ?? crypto.randomUUID(),
      cellKey,
      targetElementId: null,
      kind: "pin",
      text,
      severity,
      author: "human",
      runId: null,
    },
    target,
  );
}
