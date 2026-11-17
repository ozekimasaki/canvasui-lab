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
  atOrigin,
  renderInstance,
}: {
  doc: Document;
  id: string;
  inFlex: boolean;
  atOrigin?: boolean;
  renderInstance: (componentId: string, overrides: Record<string, unknown>) => ReactNode;
}): ReactNode {
  const node = doc.nodes[id];
  if (!node || node.hidden) return null;
  const base: CSSProperties = {
    position: inFlex ? "relative" : "absolute",
    // the CanvasNode wrapper already sits at (x, y); roots must not offset again
    left: inFlex || atOrigin ? undefined : node.x,
    top: inFlex || atOrigin ? undefined : node.y,
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
  const pushUntil = useRef(0);
  const { set } = useEditor({
    // creation tools must not let the editor select/transform existing nodes
    // (its capture-phase pointerdown commits selection regardless of pick)
    trigger: "click",
    color: "#8b5cf6",
    marquee: tool !== "H",
    pick: (element) => {
      const host = element.closest("[data-docnode]");
      return host ? [host] : [];
    },
    label: (layer) => {
      const id = docIdOf(layer);
      return id ? (docRef.current.nodes[id]?.name ?? null) : null;
    },
    onChange: (layers) => {
      const ids = layers.map((layer) => docIdOf(layer) ?? "").filter(Boolean);
      // editor.set() can echo an empty selection for freshly mounted layers;
      // never let that echo clobber a selection the app just pushed
      if (ids.length === 0 && Date.now() < pushUntil.current) return;
      pushUntil.current = 0;
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
    console.debug(
      "[dbg] effect2",
      JSON.stringify({ live: live.current, key, attempted: attempted.current }),
    );
    if (live.current.join(",") === key || attempted.current === key) return;
    attempted.current = key;
    pushUntil.current = Date.now() + 600;
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
  const handleReady = useCallback((ready: GpuCanvasApi) => {
    (window as Window & { __cul?: { canvas: GpuCanvasApi } }).__cul = { canvas: ready };
    setCanvas(ready);
  }, []);
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
    if (canvas) {
      canvas.surface.setAttribute("role", "application");
      canvas.surface.setAttribute("aria-label", "Canvas");
    }
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
    const toWorld = (event: { clientX: number; clientY: number }) => {
      const rect = canvas.surface.getBoundingClientRect();
      return canvas.screenToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    const moveRef = moveGesture;
    const onDown = (event: PointerEvent) => {
      if (!canvas.surface.contains(event.target as Node)) return;
      if (tool === "V" && event.button === 0) {
        if ((event.target as Element).closest("[data-cul-handle]")) return;
        const wp = toWorld(event);
        const hit = [...canvas.surface.querySelectorAll("[data-docnode]")]
          .map((el) => {
            const r = worldRectOf(el.getAttribute("data-docnode")!);
            return r ? { id: el.getAttribute("data-docnode")!, ...r } : null;
          })
          .filter(
            (n): n is NonNullable<typeof n> =>
              Boolean(n) &&
              !docRef.current.nodes[n.id]?.hidden &&
              wp.x >= n.x &&
              wp.x <= n.x + n.w &&
              wp.y >= n.y &&
              wp.y <= n.y + n.h,
          )
          .sort((a, b) => a.w * a.h - b.w * b.h)[0];
        // flex children are flow-positioned: library transforms cannot move
        // them, so run a product-owned reorder gesture instead
        const parent = hit
          ? Object.values(docRef.current.nodes).find(
              (n) => n.kind === "frame" && n.children.includes(hit.id),
            )
          : undefined;
        if (hit && parent && parent.kind === "frame" && parent.flex) {
          event.stopPropagation();
          onSelection([hit.id]);
          onTransformStart(hit.id);
          moveRef.current = { id: hit.id, sx: wp.x, sy: wp.y };
          return;
        }
        return;
      }
      // creation tools must not let the background pan controller move the
      // camera mid-gesture, or screenToWorld freezes and drafts collapse
      if (tool === "F" || tool === "R" || tool === "O" || tool === "T" || tool === "C") {
        event.stopPropagation();
      }
      if (tool === "F" || tool === "R" || tool === "O") {
        const p = toWorld(event);
        draftRef.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
        setDraft(draftRef.current);
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
        const rect = canvas.surface.getBoundingClientRect();
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
      const m = moveRef.current;
      if (m && tool === "V") {
        const p = toWorld(event);
        const node = docRef.current.nodes[m.id];
        if (node)
          onTransform(
            m.id,
            { x: node.x + (p.x - m.sx), y: node.y + (p.y - m.sy), w: node.w, h: node.h },
            "move",
          );
        return;
      }
      if (!draftRef.current) return;
      const p = toWorld(event);
      draftRef.current = { ...draftRef.current, x1: p.x, y1: p.y };
      setDraft(draftRef.current);
    };
    const onUp = () => {
      moveRef.current = null;
      const d = draftRef.current;
      if (!d) return;
      if (tool !== "F" && tool !== "R" && tool !== "O") {
        // tool switched mid-gesture: cancel the draft instead of committing
        draftRef.current = null;
        setDraft(null);
        return;
      }
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
      if (!canvas.surface.contains(event.target as Node)) return;
      if (event.dataTransfer?.types.includes("application/x-cul-component")) event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      if (!canvas.surface.contains(event.target as Node)) return;
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
    // window capture: overlay chrome must not swallow creation gestures
    const onDblClick = (event: MouseEvent) => {
      if (tool !== "V" || !canvas.surface.contains(event.target as Node)) return;
      const wp = toWorld(event);
      const hit = [...canvas.surface.querySelectorAll("[data-docnode]")]
        .map((el) => {
          const r = worldRectOf(el.getAttribute("data-docnode")!);
          return r ? { id: el.getAttribute("data-docnode")!, ...r } : null;
        })
        .filter(
          (n): n is NonNullable<typeof n> =>
            Boolean(n) &&
            !docRef.current.nodes[n.id]?.hidden &&
            wp.x >= n.x &&
            wp.x <= n.x + n.w &&
            wp.y >= n.y &&
            wp.y <= n.y + n.h,
        )
        .sort((a, b) => a.w * a.h - b.w * b.h)[0];
      if (hit) onSelection([hit.id]);
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("dblclick", onDblClick, true);
    window.addEventListener("dragover", onDragOver, true);
    window.addEventListener("drop", onDrop, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("dblclick", onDblClick, true);
      window.removeEventListener("dragover", onDragOver, true);
      window.removeEventListener("drop", onDrop, true);
    };
  }, [
    canvas,
    tool,
    chrome,
    onInsert,
    setTool,
    specs,
    selection,
    onSelection,
    onTransform,
    onTransformStart,
  ]);

  // product-owned resize handles: library chrome handles are unreliable in GPU
  // mode, so render our own in world space (portaled into the surface)
  const [handleCam, setHandleCam] = useState({ x: 0, y: 0, zoom: 1 });
  const worldRectOf = (id: string): { x: number; y: number; w: number; h: number } | null => {
    const node = doc.nodes[id];
    if (!node) return null;
    const parent = Object.values(doc.nodes).find(
      (n) => n.kind === "frame" && n.children.includes(id),
    );
    if (!parent || parent.kind !== "frame") return { x: node.x, y: node.y, w: node.w, h: node.h };
    const pw = worldRectOf(parent.id);
    if (!pw) return null;
    if (parent.flex) {
      // flow-positioned: derive offset from DOM relative to the parent marker
      const el = canvas?.surface.querySelector(`[data-docnode="${id}"]`);
      const pel = canvas?.surface.querySelector(`[data-docnode="${parent.id}"]`);
      if (el && pel) {
        const r = el.getBoundingClientRect();
        const pr = pel.getBoundingClientRect();
        return { x: pw.x + (r.x - pr.x), y: pw.y + (r.y - pr.y), w: r.width, h: r.height };
      }
      return { x: pw.x + node.x, y: pw.y + node.y, w: node.w, h: node.h };
    }
    return { x: pw.x + node.x, y: pw.y + node.y, w: node.w, h: node.h };
  };
  useEffect(() => {
    (window as Window & { __culWorldRect?: (id: string) => unknown }).__culWorldRect = worldRectOf;
  });
  const resizeRef = useRef<{ id: string; ax: number; ay: number } | null>(null);
  const moveGesture = useRef<{ id: string; sx: number; sy: number } | null>(null);
  const selNode = selection.length === 1 ? doc.nodes[selection[0]] : undefined;
  useEffect(() => {
    if (!canvas || !selNode || tool !== "V") return;
    setHandleCam(canvas.getCamera());
    const timer = setInterval(() => setHandleCam(canvas.getCamera()), 300);
    return () => clearInterval(timer);
  }, [canvas, selNode, tool]);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const r = resizeRef.current;
      if (!r || !canvas) return;
      const sr = canvas.surface.getBoundingClientRect();
      const cam = canvas.getCamera();
      const wx = (event.clientX - sr.x) / cam.zoom + cam.x;
      const wy = (event.clientY - sr.y) / cam.zoom + cam.y;
      const w = Math.max(8, Math.abs(wx - r.ax));
      const h = Math.max(8, Math.abs(wy - r.ay));
      const x = wx < r.ax ? r.ax - w : r.ax;
      const y = wy < r.ay ? r.ay - h : r.ay;
      onTransform(r.id, { x, y, w, h }, "resize");
    };
    const up = () => {
      resizeRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [canvas, onTransform]);
  const selRect = selNode ? (worldRectOf(selNode.id) ?? selNode) : undefined;
  const handles =
    selNode && selRect && tool === "V" && canvas ? (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
        {(
          [
            [
              "nw",
              selRect.x,
              selRect.y,
              selRect.x + selRect.w,
              selRect.y + selRect.h,
              "nwse-resize",
            ],
            [
              "ne",
              selRect.x + selRect.w,
              selRect.y,
              selRect.x,
              selRect.y + selRect.h,
              "nesw-resize",
            ],
            [
              "sw",
              selRect.x,
              selRect.y + selRect.h,
              selRect.x + selRect.w,
              selRect.y,
              "nesw-resize",
            ],
            [
              "se",
              selRect.x + selRect.w,
              selRect.y + selRect.h,
              selRect.x,
              selRect.y,
              "nwse-resize",
            ],
          ] as const
        ).map(([key, cx, cy, ax, ay, cursor]) => (
          <div
            key={key}
            data-cul-handle={key}
            onPointerDown={(event) => {
              event.stopPropagation();
              event.preventDefault();
              onTransformStart(selNode.id);
              resizeRef.current = { id: selNode.id, ax, ay };
            }}
            style={{
              position: "absolute",
              left: (cx - handleCam.x) * handleCam.zoom - 4,
              top: (cy - handleCam.y) * handleCam.zoom - 4,
              width: 8,
              height: 8,
              background: "#fff",
              border: "1px solid #8b5cf6",
              borderRadius: 2,
              pointerEvents: "auto",
              cursor,
            }}
          />
        ))}
      </div>
    ) : null;

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
      <GpuCanvas style={{ width: "100%", height: "100%" }} onReady={handleReady}>
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
                <NodeView
                  doc={doc}
                  id={id}
                  inFlex={false}
                  atOrigin
                  renderInstance={renderInstance}
                />
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
      {handles}
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
            placeholder={t("doc.comment")}
            aria-label={t("doc.comment")}
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
