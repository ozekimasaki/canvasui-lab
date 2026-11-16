import { parse as babelParse } from "@babel/parser";
import { describe, expect, it } from "vite-plus/test";
import { generateComponentCode } from "../../src/domain/figCodegen";
import {
  figColorToCss,
  mapAutoLayout,
  mapEffects,
  mapFill,
  mapFig,
  type FigIR,
} from "../../src/domain/figmap";

describe("figmap", () => {
  it("maps colors and solid fills", () => {
    expect(figColorToCss({ r: 1, g: 0, b: 0, a: 1 })).toBe("rgb(255, 0, 0)");
    expect(figColorToCss({ r: 0, g: 0, b: 0, a: 0.5 })).toBe("rgba(0, 0, 0, 0.5)");
    const report: never[] = [];
    expect(mapFill([{ type: "SOLID", color: { r: 0, g: 0, b: 1, a: 1 } }], report, "n")).toBe(
      "rgb(0, 0, 255)",
    );
  });

  it("maps gradients and reports unsupported paints", () => {
    const report: { nodeId: string; type: string; reason: string; approximation: string }[] = [];
    const css = mapFill(
      [
        {
          type: "GRADIENT_LINEAR",
          stops: [
            { color: { r: 0, g: 0, b: 0, a: 1 }, position: 0 },
            { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 },
          ],
        },
      ],
      report,
      "n",
    );
    expect(css).toContain("linear-gradient");
    mapFill([{ type: "VIDEO" }], report, "n");
    expect(report.length).toBe(1);
  });

  it("maps effects to CSS", () => {
    const report: never[] = [];
    const effects = mapEffects(
      [
        {
          type: "DROP_SHADOW",
          offset: { x: 0, y: 2 },
          radius: 4,
          color: { r: 0, g: 0, b: 0, a: 0.2 },
        },
        { type: "BACKGROUND_BLUR", radius: 8 },
      ],
      report,
      "n",
    );
    expect(effects.boxShadow).toContain("0px 2px 4px");
    expect(effects.backdropFilter).toBe("blur(8px)");
  });

  it("maps auto layout", () => {
    expect(
      mapAutoLayout({
        mode: "HORIZONTAL",
        gap: 12,
        pad: [8, 8, 8, 8],
        align: "CENTER",
        justify: "SPACE_BETWEEN",
      }),
    ).toEqual({
      dir: "h",
      gap: 12,
      pad: [8, 8, 8, 8],
      align: "center",
      justify: "between",
    });
    expect(mapAutoLayout({ mode: "NONE" })).toBeNull();
    expect(mapAutoLayout(null)).toBeNull();
  });

  it("maps a full tree with components, instances and unsupported nodes", () => {
    const ir: FigIR = {
      nodes: [
        {
          id: "c1",
          type: "COMPONENT",
          name: "Card",
          x: 0,
          y: 0,
          w: 200,
          h: 100,
          fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 } }],
        },
        {
          id: "t1",
          type: "TEXT",
          name: "label",
          x: 8,
          y: 8,
          w: 100,
          h: 20,
          text: { characters: "Hello", size: 16, weight: 700, color: "#000", align: "left" },
        },
        {
          id: "i1",
          type: "INSTANCE",
          name: "Card instance",
          x: 300,
          y: 0,
          w: 200,
          h: 100,
          componentRef: "c1",
          overrides: { label: "World" },
        },
        { id: "s1", type: "SLICE", name: "slice", x: 0, y: 0, w: 10, h: 10 },
      ],
      children: { c1: ["t1"] },
      roots: ["c1", "i1"],
    };
    const result = mapFig(ir);
    expect(result.roots).toEqual(["c1", "i1"]);
    expect(result.nodes.i1.kind).toBe("instance");
    expect(result.components).toEqual([
      { id: "c1", name: "Card", rootId: "c1", propKeys: ["label"] },
    ]);
    expect(result.report.some((entry) => entry.type === "SLICE")).toBe(true);
    const code = generateComponentCode(result.components[0], result.nodes);
    expect(() =>
      babelParse(code, { sourceType: "module", plugins: ["typescript", "jsx"] }),
    ).not.toThrow();
    expect(code).toContain("label?: string | number | boolean");
  });
});
