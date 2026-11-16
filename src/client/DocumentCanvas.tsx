import { fitCamera, zoomAt, type GpuCanvas as GpuCanvasApi } from "gpucanvas";
import { CanvasNode, GpuCanvas, useEditor, useGpuCanvas } from "gpucanvas/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { ComponentSpecData } from "../domain/brands";
import type { DocNode, Document, FlexLayout, FrameNode } from "../domain/document";
import type { MatrixCell } from "../domain/matrix";
import { addHumanMark } from "./auditClient";
import { useI18n } from "./i18n";

export type Tool = "V" | "H" | "F" | "T" | "C" | "A" | "R" | "O" | "Z";

export function flexStyle(flex: FlexLayout): CSSProperties {
  return {
    display: "flex",
    flexDirection: flex.dir === "h" ? "row" : "column",
    gap: flex.gap,
    padding: flex.pad.map((v) => `${v}px`).join(" "),
    alignItems:
      flex.align === "start" ? "flex-start" : flex.align === "end" ? "flex-end" : flex.align,
    justifyContent:
      flex.justify === "start"
        ? "flex-start"
        : flex.justify === "end"
          ? "flex-end"
          : flex.justify === "between"
            ? "space-between"
            : flex.justify === "around"
              ? "space-around"
              : "center",
  };
}

function NodeView({
  doc,
  id,
  inFlex,
  renderInstance,
}: {
  doc: Document;
  id: string;
  inFlex: boolean;
  renderInstance: (componentId: string, overrides: Record<string, unknown>) => ReactNode;
}): ReactNode {
  const node = doc.nodes[id];
  if (!node || node.hidden) return null;
  const base: CSSProperties = {
    position: inFlex ? "relative" : "absolute",
    left: inFlex ? undefined : node.x,
    top: inFlex ? undefined : node.y,
    width: node.w,
    height: node.h,
    boxSizing: "border-box",
    opacity: node.opacity,
    boxShadow: node.boxShadow,
    filter: node.filter,
    backdropFilter: node.backdropFilter,
  };
  const common = { "data-docnode": node.id, "data-kind": node.kind, style: base };
  if (node.kind === "frame") {
    return (
      <div
        {...common}
        style={{
          ...base,
          ...(node.flex ? flexStyle(node.flex) : {}),
          overflow: node.clip ? "hidden" : "visible",
          background: node.fill ?? "transparent",
          border: node.stroke ? `1px solid ${node.stroke}` : undefined,
          borderRadius: node.radius,
        }}
      >
        {node.children.map((child) => (
          <NodeView
            key={child}
            doc={doc}
            id={child}
            inFlex={Boolean(node.flex)}
            renderInstance={renderInstance}
          />
        ))}
      </div>
    );
  }
  if (node.kind === "instance") {
    return (
      <div {...common} className={node.className} style={{ ...base, overflow: "hidden" }}>
        {renderInstance(node.componentId, node.overrides)}
      </div>
    );
  }
  if (node.kind === "shape") {
    return (
      <div
        {...common}
        style={{
          ...base,
          background: node.fill ?? "#d9d9d9",
          border: node.stroke ? `1px solid ${node.stroke}` : undefined,
          borderRadius: node.shape === "ellipse" ? "50%" : node.radius,
        }}
      />
    );
  }
  if (node.kind === "text") {
    return (
      <div
        {...common}
        style={{
          ...base,
          color: node.color,
          fontSize: node.size,
          fontWeight: node.weight,
          textAlign: node.align,
          whiteSpace: "pre-wrap",
          overflow: "hidden",
        }}
      >
        {node.content}
      </div>
    );
  }
  return (
    <div
      {...common}
      style={{ ...base, overflow: "hidden" }}
      dangerouslySetInnerHTML={{ __html: node.svg }}
    />
  );
}

function docIdOf(layer: Element[] | undefined): string | null {
  const el = layer?.[0];
  return (
    el?.getAttribute("data-docnode") ??
    el?.querySelector("[data-docnode]")?.getAttribute("data-docnode") ??
    null
  );
}

function DocEditorBridge({
  doc,
  tool,
  selection,
  onSelection,
  onTransformStart,
  onTransform,
}: {
  doc: Document;
  tool: Tool;
  selection: string[];
  onSelection: (ids: string[]) => void;
  onTransformStart: (id: string) => void;
  onTransform: (
    id: string,
    rect: { x: number; y: number; w: number; h: number },
    kind: "move" | "resize",
  ) => void;
}) {
  const docRef = useRef(doc);
  docRef.current = doc;
  const canvas = useGpuCanvas();
  const live = useRef<string[]>([]);
  const attempted = useRef<string>("");
  const { set } = useEditor({
    trigger: "click",
    color: "#8b5cf6",
    marquee: tool !== "H",
    pick: (element) => {
      if (tool !== "V") return [];
      const host = element.closest("[data-docnode]");
      return host ? [host] : [];
    },
    label: (layer) => {
      const id = docIdOf(layer);
      return id ? (docRef.current.nodes[id]?.name ?? null) : null;
    },
    onChange: (layers) => {
      const ids = layers.map((layer) => docIdOf(layer) ?? "").filter(Boolean);
      live.current = ids;
      attempted.current = ids.join(",");
      onSelection(ids);
    },
    onTransform: (event) => {
      const id = docIdOf(event.layers[0]);
      if (!id) return;
      if (event.phase === "start") onTransformStart(id);
      if (event.phase === "move" || event.phase === "end") {
        const to = event.to[0];
        onTransform(id, { x: to.x, y: to.y, w: to.width, h: to.height }, event.kind);
      }
    },
  });
  // App selection is authoritative for panel-driven changes; the editor reports
  // canvas-driven changes through onChange. Comparing against a live ref (not
  // React state) avoids a one-render-delayed echo loop between the two.
  useEffect(() => {
    if (!canvas || !set) return;
    const key = selection.join(",");
    if (live.current.join(",") === key || attempted.current === key) return;
    attempted.current = key;
    live.current = selection;
    const layers = selection
      .map((id) => canvas.surface.querySelector(`[data-docnode="${id}"]`))
      .filter((el): el is Element => Boolean(el));
    set(layers);
  }, [selection, canvas, set]);
  return null;
}

export interface DocumentCanvasProps {
  doc: Document;
  tool: Tool;
  setTool: (t: Tool) => void;
  selection: string[];
  onSelection: (ids: string[]) => void;
  onInsert: (node: DocNode) => void;
  onTransformStart: (id: string) => void;
  onTransform: (
    id: string,
    rect: { x: number; y: number; w: number; h: number },
    kind: "move" | "resize",
  ) => void;
  onCanvas: (canvas: GpuCanvasApi | null) => void;
  specs: ComponentSpecData[];
  renderCell: (cell: MatrixCell) => ReactNode;
  chrome: "light" | "dark";
}

export function DocumentCanvas({
  doc,
  tool,
  setTool,
  selection,
  onSelection,
  onInsert,
  onTransformStart,
  onTransform,
  onCanvas,
  specs,
  renderCell,
  chrome,
}: DocumentCanvasProps) {
  const { t } = useI18n();
  const [canvas, setCanvas] = useState<GpuCanvasApi | null>(null);
  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    null,
  );
  const [comment, setComment] = useState<{
    x: number;
    y: number;
    sx: number;
    sy: number;
    text: string;
  } | null>(null);
  const draftRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  useEffect(() => {
    onCanvas(canvas);
    canvas?.setBackground(chrome === "dark" ? "#0b0d10" : "#f4f5f7");
  }, [canvas, chrome, onCanvas]);

  const renderInstance = useCallback(
    (componentId: string, overrides: Record<string, unknown>) =>
      renderCell({
        componentId,
        args: overrides,
        axisValues: {},
        cellKey: `doc:${componentId}`,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      } as unknown as MatrixCell),
    [renderCell],
  );

  useEffect(() => {
    if (!canvas) return;
    const surface = canvas.surface;
    const toWorld = (event: { clientX: number; clientY: number }) => {
      const rect = surface.getBoundingClientRect();
      return canvas.screenToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    const onDown = (event: PointerEvent) => {
      // creation tools must not let the background pan controller move the
      // camera mid-gesture, or screenToWorld freezes and drafts collapse
      if (tool === "F" || tool === "R" || tool === "O" || tool === "T" || tool === "C") {
        event.stopPropagation();
      }
      if (tool === "F" || tool === "R" || tool === "O") {
        const p = toWorld(event);
        draftRef.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
        setDraft(draftRef.current);
        try {
          surface.setPointerCapture(event.pointerId);
        } catch {
          // synthetic pointers (E2E) have no active pointer to capture
        }
      } else if (tool === "T") {
        const p = toWorld(event);
        onInsert({
          id: crypto.randomUUID(),
          kind: "text",
          name: "Text",
          x: p.x,
          y: p.y,
          w: 200,
          h: 32,
          content: "Text",
          size: 16,
          weight: 400,
          color: chrome === "dark" ? "#e6e8eb" : "#1a1d21",
          align: "left",
        });
        setTool("V");
      } else if (tool === "C") {
        const p = toWorld(event);
        const rect = surface.getBoundingClientRect();
        setComment({
          x: p.x,
          y: p.y,
          sx: event.clientX - rect.left,
          sy: event.clientY - rect.top,
          text: "",
        });
      }
    };
    const onMove = (event: PointerEvent) => {
      if (!draftRef.current) return;
      const p = toWorld(event);
      draftRef.current = { ...draftRef.current, x1: p.x, y1: p.y };
      setDraft(draftRef.current);
    };
    const onUp = () => {
      const d = draftRef.current;
      if (!d) return;
      draftRef.current = null;
      setDraft(null);
      const x = Math.min(d.x0, d.x1);
      const y = Math.min(d.y0, d.y1);
      const w = Math.max(24, Math.abs(d.x1 - d.x0));
      const h = Math.max(24, Math.abs(d.y1 - d.y0));
      const id = crypto.randomUUID();
      if (tool === "F") {
        onInsert({
          id,
          kind: "frame",
          name: "Frame",
          x,
          y,
          w,
          h,
          flex: null,
          clip: true,
          fill: chrome === "dark" ? "#16191d" : "#ffffff",
          children: [],
        });
      } else {
        onInsert({
          id,
          kind: "shape",
          name: tool === "R" ? "Rectangle" : "Ellipse",
          shape: tool === "R" ? "rect" : "ellipse",
          x,
          y,
          w,
          h,
          fill: "#8b5cf6",
        });
      }
      setTool("V");
    };
    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("application/x-cul-component")) event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      const componentId = event.dataTransfer?.getData("application/x-cul-component");
      if (!componentId) return;
      event.preventDefault();
      const p = toWorld(event);
      const spec = specs.find((s) => s.id === componentId);
      onInsert({
        id: crypto.randomUUID(),
        kind: "instance",
        name: spec?.title ?? componentId,
        componentId,
        x: p.x,
        y: p.y,
        w: 260,
        h: 160,
        overrides: {},
      });
    };
    surface.addEventListener("pointerdown", onDown, true);
    surface.addEventListener("pointermove", onMove);
    surface.addEventListener("pointerup", onUp);
    surface.addEventListener("dragover", onDragOver);
    surface.addEventListener("drop", onDrop);
    return () => {
      surface.removeEventListener("pointerdown", onDown, true);
      surface.removeEventListener("pointermove", onMove);
      surface.removeEventListener("pointerup", onUp);
      surface.removeEventListener("dragover", onDragOver);
      surface.removeEventListener("drop", onDrop);
    };
  }, [canvas, tool, chrome, onInsert, setTool, specs]);

  const cursor =
    tool === "H"
      ? "grab"
      : tool === "F" || tool === "R" || tool === "O" || tool === "T" || tool === "C"
        ? "crosshair"
        : tool === "Z"
          ? "zoom-in"
          : "default";

  return (
    <div style={{ position: "absolute", inset: 0, cursor }}>
      <GpuCanvas
        style={{ width: "100%", height: "100%" }}
        onReady={(ready) => {
          (window as Window & { __cul?: { canvas: GpuCanvasApi } }).__cul = { canvas: ready };
          setCanvas(ready);
        }}
      >
        <DocEditorBridge
          doc={doc}
          tool={tool}
          selection={selection}
          onSelection={onSelection}
          onTransformStart={onTransformStart}
          onTransform={onTransform}
        />
        {doc.roots.map((id) => {
          const node = doc.nodes[id];
          if (!node) return null;
          return (
            <CanvasNode key={id} x={node.x} y={node.y} width={node.w} height={node.h}>
              <div style={{ position: "relative", width: "100%", height: "100%" }}>
                <NodeView doc={doc} id={id} inFlex={false} renderInstance={renderInstance} />
              </div>
            </CanvasNode>
          );
        })}
        {draft && (
          <CanvasNode
            x={Math.min(draft.x0, draft.x1)}
            y={Math.min(draft.y0, draft.y1)}
            width={Math.max(1, Math.abs(draft.x1 - draft.x0))}
            height={Math.max(1, Math.abs(draft.y1 - draft.y0))}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                border: "1px dashed #8b5cf6",
                background: "rgba(139,92,246,0.08)",
              }}
            />
          </CanvasNode>
        )}
      </GpuCanvas>
      {doc.roots.length === 0 && !draft && (
        <div
          className="cul-hint"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%,-50%)",
            pointerEvents: "none",
          }}
        >
          {t("empty.doc")}
        </div>
      )}
      {comment && (
        <div
          className="cul-panel"
          style={{
            position: "absolute",
            left: comment.sx,
            top: comment.sy,
            padding: 8,
            width: 220,
          }}
        >
          <input
            autoFocus
            className="cul-input-field"
            style={{ width: "100%" }}
            placeholder="Comment…"
            value={comment.text}
            onChange={(e) => setComment({ ...comment, text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && comment.text.trim() && canvas) {
                const host = canvas.surface.querySelector(`[data-docnode]`);
                void addHumanMark(
                  canvas,
                  `doc:${comment.x.toFixed(0)}:${comment.y.toFixed(0)}`,
                  host,
                  comment.text.trim(),
                  "info",
                ).catch(() => undefined);
                setComment(null);
                setTool("V");
              }
              if (e.key === "Escape") setComment(null);
            }}
          />
        </div>
      )}
      {selection.length === 0 && null}
    </div>
  );
}

export function fitDocument(canvas: GpuCanvasApi, doc: Document) {
  const nodes = Object.values(doc.nodes);
  if (nodes.length === 0) return;
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + n.w));
  const maxY = Math.max(...nodes.map((n) => n.y + n.h));
  const rect = canvas.surface.getBoundingClientRect();
  canvas.setCamera(
    fitCamera(
      { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      rect.width,
      rect.height,
      80,
    ),
  );
}

export function zoomDocument(canvas: GpuCanvasApi, factor: number) {
  const rect = canvas.surface.getBoundingClientRect();
  canvas.setCamera(zoomAt(canvas.getCamera(), rect.width / 2, rect.height / 2, factor));
}

export type { FrameNode };
