import type {
  DocNode,
  FlexLayout,
  FrameNode,
  InstanceNode,
  ShapeNode,
  SvgNode,
  TextNode,
} from "./document";

export interface FigPaintLike {
  type?: string;
  color?: { r: number; g: number; b: number; a: number };
  opacity?: number;
  visible?: boolean;
  stops?: { color: { r: number; g: number; b: number; a: number }; position: number }[];
  image?: { hash?: unknown };
  imageUrl?: string;
}

export interface FigEffectLike {
  type?: string;
  color?: { r: number; g: number; b: number; a: number };
  offset?: { x: number; y: number };
  radius?: number;
  spread?: number;
  visible?: boolean;
}

export interface FigIRNode {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity?: number;
  fills?: FigPaintLike[];
  strokes?: FigPaintLike[];
  strokeWeight?: number;
  radius?: number;
  effects?: FigEffectLike[];
  clip?: boolean;
  resizeToFit?: boolean;
  stack?: {
    mode: string;
    gap?: number;
    pad?: [number, number, number, number];
    align?: string;
    justify?: string;
  } | null;
  text?: { characters: string; size?: number; weight?: number; color?: string; align?: string };
  svg?: string;
  componentRef?: string;
  overrides?: Record<string, unknown>;
}

export interface FigIR {
  nodes: FigIRNode[];
  children: Record<string, string[]>;
  roots: string[];
  tokens?: {
    name: string;
    type: "color" | "number" | "string" | "boolean";
    collection: string;
    values: Record<string, string | number | boolean>;
  }[];
}

export interface FidelityEntry {
  nodeId: string;
  type: string;
  reason: string;
  approximation: string;
}

export interface FigComponentDef {
  id: string;
  name: string;
  rootId: string;
  propKeys: string[];
}

export interface FigMapResult {
  nodes: Record<string, DocNode>;
  roots: string[];
  components: FigComponentDef[];
  report: FidelityEntry[];
}

export function figColorToCss(
  color: { r: number; g: number; b: number; a: number },
  opacity = 1,
): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = Math.round(color.a * opacity * 1000) / 1000;
  return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function mapFill(
  paints: FigPaintLike[] | undefined,
  report: FidelityEntry[],
  nodeId: string,
): string | undefined {
  const paint = (paints ?? []).find((p) => p.visible !== false);
  if (!paint) return undefined;
  if (paint.type === "SOLID" && paint.color) return figColorToCss(paint.color, paint.opacity ?? 1);
  if (
    (paint.type === "GRADIENT_LINEAR" ||
      paint.type === "GRADIENT_RADIAL" ||
      paint.type === "GRADIENT_ANGULAR" ||
      paint.type === "GRADIENT_DIAMOND") &&
    paint.stops?.length
  ) {
    const stops = paint.stops
      .map((s) => `${figColorToCss(s.color)} ${Math.round(s.position * 100)}%`)
      .join(", ");
    if (paint.type === "GRADIENT_LINEAR") return `linear-gradient(180deg, ${stops})`;
    if (paint.type === "GRADIENT_RADIAL") return `radial-gradient(circle, ${stops})`;
    report.push({
      nodeId,
      type: paint.type ?? "GRADIENT",
      reason: "angular/diamond gradient not representable in CSS",
      approximation: "radial-gradient",
    });
    return `radial-gradient(circle, ${stops})`;
  }
  if (paint.type === "IMAGE") {
    if (paint.imageUrl) return `url(${paint.imageUrl}) center / cover no-repeat`;
    report.push({
      nodeId,
      type: "IMAGE",
      reason: "image bytes unavailable",
      approximation: "solid placeholder",
    });
    return "rgba(128,128,128,0.25)";
  }
  report.push({
    nodeId,
    type: paint.type ?? "UNKNOWN",
    reason: "unsupported paint type",
    approximation: "transparent",
  });
  return undefined;
}

export function mapEffects(
  effects: FigEffectLike[] | undefined,
  report: FidelityEntry[],
  nodeId: string,
): { boxShadow?: string; filter?: string; backdropFilter?: string } {
  const out: { boxShadow?: string; filter?: string; backdropFilter?: string } = {};
  const shadows: string[] = [];
  for (const effect of effects ?? []) {
    if (effect.visible === false) continue;
    if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
      const inset = effect.type === "INNER_SHADOW" ? "inset " : "";
      shadows.push(
        `${inset}${effect.offset?.x ?? 0}px ${effect.offset?.y ?? 0}px ${effect.radius ?? 0}px ${effect.spread ?? 0}px ${effect.color ? figColorToCss(effect.color) : "rgba(0,0,0,0.25)"}`,
      );
    } else if (effect.type === "FOREGROUND_BLUR" || effect.type === "LAYER_BLUR") {
      out.filter = `blur(${effect.radius ?? 0}px)`;
    } else if (effect.type === "BACKGROUND_BLUR") {
      out.backdropFilter = `blur(${effect.radius ?? 0}px)`;
    } else if (effect.type) {
      report.push({
        nodeId,
        type: effect.type,
        reason: "effect has no CSS equivalent",
        approximation: "ignored",
      });
    }
  }
  if (shadows.length) out.boxShadow = shadows.join(", ");
  return out;
}

const ALIGN_MAP: Record<string, FlexLayout["align"]> = {
  MIN: "start",
  CENTER: "center",
  MAX: "end",
  STRETCH: "stretch",
  BASELINE: "start",
};
const JUSTIFY_MAP: Record<string, FlexLayout["justify"]> = {
  MIN: "start",
  CENTER: "center",
  MAX: "end",
  SPACE_BETWEEN: "between",
  SPACE_AROUND: "around",
};

export function mapAutoLayout(stack: FigIRNode["stack"]): FlexLayout | null {
  if (!stack || (stack.mode !== "HORIZONTAL" && stack.mode !== "VERTICAL")) return null;
  return {
    dir: stack.mode === "HORIZONTAL" ? "h" : "v",
    gap: stack.gap ?? 0,
    pad: stack.pad ?? [0, 0, 0, 0],
    align: ALIGN_MAP[stack.align ?? "MIN"] ?? "start",
    justify: JUSTIFY_MAP[stack.justify ?? "MIN"] ?? "start",
  };
}

function slug(name: string): string {
  return (
    name
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "node"
  );
}

export function mapFig(ir: FigIR): FigMapResult {
  const nodes: Record<string, DocNode> = {};
  const report: FidelityEntry[] = [];
  const components: FigComponentDef[] = [];
  const byId = new Map(ir.nodes.map((n) => [n.id, n]));
  const propKeysByComponent = new Map<string, Set<string>>();

  for (const fig of ir.nodes) {
    if (fig.type === "INSTANCE" && fig.componentRef) {
      const set = propKeysByComponent.get(fig.componentRef) ?? new Set<string>();
      for (const key of Object.keys(fig.overrides ?? {})) set.add(key);
      propKeysByComponent.set(fig.componentRef, set);
    }
  }

  const mapOne = (fig: FigIRNode): DocNode | null => {
    const base = {
      id: fig.id,
      name: fig.name,
      x: fig.x,
      y: fig.y,
      w: Math.max(1, fig.w),
      h: Math.max(1, fig.h),
      opacity: fig.opacity,
    };
    const fill = mapFill(fig.fills, report, fig.id);
    const strokePaint = (fig.strokes ?? []).find(
      (p) => p.visible !== false && p.type === "SOLID" && p.color,
    );
    const stroke = strokePaint?.color
      ? figColorToCss(strokePaint.color, strokePaint.opacity ?? 1)
      : undefined;
    const effects = mapEffects(fig.effects, report, fig.id);
    const children = ir.children[fig.id] ?? [];

    if (
      fig.type === "FRAME" ||
      fig.type === "SECTION" ||
      fig.type === "GROUP" ||
      fig.type === "COMPONENT"
    ) {
      const flex = fig.resizeToFit ? null : mapAutoLayout(fig.stack);
      const frame: FrameNode = {
        ...base,
        kind: "frame",
        flex,
        clip: fig.type === "GROUP" ? false : (fig.clip ?? true),
        fill: fig.type === "GROUP" ? undefined : fill,
        stroke,
        radius: fig.radius,
        children,
        ...effects,
      } as FrameNode;
      if (fig.type === "COMPONENT") {
        components.push({
          id: fig.id,
          name: fig.name,
          rootId: fig.id,
          propKeys: [...(propKeysByComponent.get(fig.id) ?? [])],
        });
      }
      if (fig.type === "SECTION")
        report.push({
          nodeId: fig.id,
          type: fig.type,
          reason: "section semantics lost",
          approximation: "frame",
        });
      return frame;
    }
    if (fig.type === "INSTANCE") {
      if (!fig.componentRef || !byId.has(fig.componentRef)) {
        report.push({
          nodeId: fig.id,
          type: fig.type,
          reason: "component definition not found in file",
          approximation: "frame copy",
        });
        const frame: FrameNode = {
          ...base,
          kind: "frame",
          flex: mapAutoLayout(fig.stack),
          clip: fig.clip ?? true,
          fill,
          stroke,
          radius: fig.radius,
          children,
          ...effects,
        } as FrameNode;
        return frame;
      }
      const instance: InstanceNode = {
        ...base,
        kind: "instance",
        componentId: `fig-${slug(byId.get(fig.componentRef)!.name)}`,
        overrides: fig.overrides ?? {},
        ...effects,
      } as InstanceNode;
      return instance;
    }
    if (fig.type === "TEXT") {
      const text: TextNode = {
        ...base,
        kind: "text",
        content: fig.text?.characters ?? "",
        size: fig.text?.size ?? 14,
        weight: fig.text?.weight ?? 400,
        color: fig.text?.color ?? fill ?? "#000000",
        align: (fig.text?.align as TextNode["align"]) ?? "left",
        ...effects,
      } as TextNode;
      return text;
    }
    if (fig.type === "ELLIPSE") {
      return {
        ...base,
        kind: "shape",
        shape: "ellipse",
        fill,
        stroke,
        radius: fig.radius,
        ...effects,
      } as ShapeNode;
    }
    if (
      fig.type === "RECTANGLE" ||
      fig.type === "ROUNDED_RECTANGLE" ||
      fig.type === "LINE" ||
      fig.type === "STAR" ||
      fig.type === "POLYGON"
    ) {
      if (fig.svg) return { ...base, kind: "svg", svg: fig.svg, ...effects } as SvgNode;
      if (fig.type !== "RECTANGLE" && fig.type !== "ROUNDED_RECTANGLE")
        report.push({
          nodeId: fig.id,
          type: fig.type,
          reason: "vector geometry unavailable",
          approximation: "rectangle",
        });
      return {
        ...base,
        kind: "shape",
        shape: "rect",
        fill,
        stroke,
        radius: fig.radius,
        ...effects,
      } as ShapeNode;
    }
    if (fig.type === "VECTOR" || fig.type === "BOOLEAN_OPERATION" || fig.type === "BRUSH") {
      if (fig.svg) return { ...base, kind: "svg", svg: fig.svg, ...effects } as SvgNode;
      report.push({
        nodeId: fig.id,
        type: fig.type,
        reason: "vector geometry could not be reconstructed",
        approximation: "rectangle placeholder",
      });
      return {
        ...base,
        kind: "shape",
        shape: "rect",
        fill: fill ?? "rgba(128,128,128,0.25)",
        stroke,
        ...effects,
      } as ShapeNode;
    }
    report.push({
      nodeId: fig.id,
      type: fig.type,
      reason: "node type not supported",
      approximation: "skipped",
    });
    return null;
  };

  for (const fig of ir.nodes) {
    const mapped = mapOne(fig);
    if (mapped) nodes[fig.id] = mapped;
  }
  for (const node of Object.values(nodes)) {
    if (node.kind === "frame") node.children = node.children.filter((id) => nodes[id]);
  }
  const roots = ir.roots.filter((id) => nodes[id]);
  return { nodes, roots, components, report };
}
