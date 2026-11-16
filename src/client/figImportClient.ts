import {
  nodeId,
  parseFig,
  resolveVectorNodePaths,
  type FigDocument,
  type FigNode,
  type FigPaint,
} from "openfig-core";
import { figColorToCss, type FigIR, type FigIRNode } from "../domain/figmap";
import { apiFetch } from "./api";

const WEIGHT_BY_STYLE: Record<string, number> = {
  thin: 100,
  extralight: 200,
  ultralight: 200,
  light: 300,
  regular: 400,
  normal: 400,
  book: 400,
  medium: 500,
  semibold: 600,
  demibold: 600,
  bold: 700,
  extrabold: 800,
  ultrabold: 800,
  black: 900,
  heavy: 900,
};

function guidKey(guid: { sessionID: number; localID: number } | undefined | null): string | null {
  return guid ? `${guid.sessionID}:${guid.localID}` : null;
}

function firstSolidCss(paints: FigPaint[] | undefined): string | undefined {
  const paint = (paints ?? []).find((p) => p.visible !== false && p.type === "SOLID" && p.color);
  return paint?.color ? figColorToCss(paint.color, paint.opacity ?? 1) : undefined;
}

function bytesToDataUrl(bytes: Uint8Array): string {
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${isPng ? "image/png" : "image/jpeg"};base64,${btoa(binary)}`;
}

function vectorSvg(fig: FigDocument, node: FigNode, w: number, h: number): string | undefined {
  try {
    const resolved = resolveVectorNodePaths(fig, node);
    const paths = resolved.fill.length ? resolved.fill : resolved.stroke;
    if (!paths.length) return undefined;
    const parts = paths
      .filter((p) => p.svgPath)
      .map(
        (p) =>
          `<path d="${p.svgPath}" fill="${firstSolidCss(p.paints ?? node.fillPaints) ?? "#888888"}" fill-rule="${p.windingRule === "EVENODD" ? "evenodd" : "nonzero"}"/>`,
      )
      .join("");
    if (!parts) return undefined;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.max(1, w)} ${Math.max(1, h)}" width="100%" height="100%" preserveAspectRatio="none">${parts}</svg>`;
  } catch {
    return undefined;
  }
}

export interface FigImportResult {
  roots: string[];
  report: { nodeId: string; type: string; reason: string; approximation: string }[];
  components: { name: string; filePath: string; written: boolean }[];
}

export function buildFigIR(fig: FigDocument): {
  ir: FigIR;
  assets: { key: string; dataUrl: string }[];
} {
  const keyOf = (node: FigNode) => nodeId(node) ?? guidKey(node.guid) ?? "";
  const byKey = new Map<string, FigNode>();
  for (const node of fig.nodes) byKey.set(keyOf(node), node);

  const children: Record<string, string[]> = {};
  const roots: string[] = [];
  const images = new Map<string, string>();
  for (const [hash, data] of fig.images) images.set(hash, bytesToDataUrl(data));

  const irNodes: FigIRNode[] = [];
  for (const node of fig.nodes) {
    const id = keyOf(node);
    if (node.type === "DOCUMENT" || node.type === "CANVAS") continue;
    const parentKey = guidKey(node.parentIndex?.guid);
    const parent = parentKey ? byKey.get(parentKey) : undefined;
    if (parent && parent.type !== "DOCUMENT" && parent.type !== "CANVAS") {
      (children[parentKey!] ??= []).push(id);
    } else {
      roots.push(id);
    }
    const w = node.size?.x ?? 100;
    const h = node.size?.y ?? 100;
    const fills = (node.fillPaints ?? []).map((paint) => {
      if (paint.type === "IMAGE" && paint.image?.hash) {
        const hash =
          typeof paint.image.hash === "string"
            ? paint.image.hash
            : Array.from(paint.image.hash as Uint8Array)
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
        const url = images.get(hash);
        if (url) return { ...paint, imageUrl: url };
      }
      return paint;
    });
    const stackMode = node.stackMode as string | undefined;
    const ir: FigIRNode = {
      id,
      type: node.type,
      name: node.name ?? node.type,
      x: node.transform?.m02 ?? 0,
      y: node.transform?.m12 ?? 0,
      w,
      h,
      opacity: node.opacity,
      fills,
      strokes: node.strokePaints,
      strokeWeight: node.strokeWeight,
      radius: node.cornerRadius,
      effects: node.effects,
      clip: node.frameMaskDisabled === false,
      resizeToFit: node.resizeToFit,
      stack:
        stackMode && stackMode !== "NONE"
          ? {
              mode: stackMode,
              gap: (node.stackSpacing as number) ?? (node.itemSpacing as number) ?? 0,
              pad: [
                (node.stackPaddingTop as number) ?? (node.paddingTop as number) ?? 0,
                (node.stackPaddingRight as number) ?? (node.paddingRight as number) ?? 0,
                (node.stackPaddingBottom as number) ?? (node.paddingBottom as number) ?? 0,
                (node.stackPaddingLeft as number) ?? (node.paddingLeft as number) ?? 0,
              ],
              align:
                (node.stackCounterAlignItems as string) ?? (node.counterAxisAlignItems as string),
              justify:
                (node.stackPrimaryAlignItems as string) ?? (node.primaryAxisAlignItems as string),
            }
          : null,
    };
    if (node.type === "TEXT") {
      const style = (node.fontName?.style ?? "Regular").toLowerCase();
      const weightKey = Object.keys(WEIGHT_BY_STYLE).find((key) => style.includes(key));
      ir.text = {
        characters: node.textData?.characters ?? "",
        size: node.fontSize ?? 14,
        weight: weightKey ? WEIGHT_BY_STYLE[weightKey] : 400,
        color: firstSolidCss(node.fillPaints),
        align:
          node.textAlignHorizontal === "CENTER"
            ? "center"
            : node.textAlignHorizontal === "RIGHT"
              ? "right"
              : "left",
      };
    }
    if (
      node.type === "VECTOR" ||
      node.type === "BOOLEAN_OPERATION" ||
      node.type === "STAR" ||
      node.type === "BRUSH" ||
      node.type === "ROUNDED_RECTANGLE" ||
      node.type === "POLYGON" ||
      node.type === "LINE"
    ) {
      ir.svg = vectorSvg(fig, node, w, h);
    }
    if (node.type === "INSTANCE") {
      const symbolGuid =
        (
          node.componentData as
            | { symbolID?: { guid?: { sessionID: number; localID: number } } }
            | undefined
        )?.symbolID?.guid ??
        (
          node.symbolData as
            | { symbolID?: { guid?: { sessionID: number; localID: number } } }
            | undefined
        )?.symbolID?.guid ??
        (node.symbolID as { guid?: { sessionID: number; localID: number } } | undefined)?.guid;
      const componentKey = guidKey(symbolGuid);
      ir.componentRef = componentKey ?? undefined;
      const properties = (node.componentProperties ?? {}) as Record<string, unknown>;
      ir.overrides = Object.fromEntries(
        Object.entries(properties).map(([key, def]) => [
          key,
          def && typeof def === "object" && "value" in def
            ? (def as { value: unknown }).value
            : def,
        ]),
      );
    }
    irNodes.push(ir);
  }

  const tokens: NonNullable<FigIR["tokens"]> = [];
  const variableDefs = (fig.message as { variableDefs?: unknown[] } | undefined)?.variableDefs;
  if (Array.isArray(variableDefs)) {
    for (const def of variableDefs) {
      const record = def as {
        name?: string;
        type?: string;
        valuesByMode?: Record<string, unknown>;
      };
      if (!record.name) continue;
      const first = Object.values(record.valuesByMode ?? {})[0];
      if (first && typeof first === "object" && "r" in (first as object)) {
        tokens.push({
          name: record.name,
          type: "color",
          collection: "figma",
          values: { value: figColorToCss(first as { r: number; g: number; b: number; a: number }) },
        });
      } else if (
        typeof first === "number" ||
        typeof first === "string" ||
        typeof first === "boolean"
      ) {
        tokens.push({
          name: record.name,
          type:
            typeof first === "number"
              ? "number"
              : typeof first === "boolean"
                ? "boolean"
                : "string",
          collection: "figma",
          values: { value: first },
        });
      }
    }
  }

  const assets = [...images.entries()].slice(0, 64).map(([key, dataUrl]) => ({ key, dataUrl }));
  return { ir: { nodes: irNodes, children, roots, tokens }, assets };
}

export async function importFigFile(file: File): Promise<{
  nodes: Record<string, import("../domain/document").DocNode>;
  roots: string[];
  report: FigImportResult["report"];
  components: FigImportResult["components"];
}> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fig = parseFig(bytes);
  const { ir, assets } = buildFigIR(fig);
  const res = await apiFetch("/api/fig/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...ir, assets }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fig import failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as {
    nodes: Record<string, import("../domain/document").DocNode>;
    roots: string[];
    report: FigImportResult["report"];
    components: FigImportResult["components"];
  };
}
