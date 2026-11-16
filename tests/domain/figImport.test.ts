import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFig } from "openfig-core";
import { describe, expect, it } from "vite-plus/test";
import { buildFigIR } from "../../src/client/figImportClient";
import { mapFig } from "../../src/domain/figmap";

const fixture = (name: string) =>
  new Uint8Array(readFileSync(join(__dirname, "../fixtures", name)));

describe("fig import pipeline", () => {
  it("decodes circle.fig into an ellipse shape", () => {
    const fig = parseFig(fixture("circle.fig"));
    const { ir } = buildFigIR(fig);
    const result = mapFig(ir);
    const shapes = Object.values(result.nodes).filter((n) => n.kind === "shape");
    expect(shapes.some((n) => n.kind === "shape" && n.shape === "ellipse")).toBe(true);
    expect(result.roots.length).toBeGreaterThan(0);
  });

  it("decodes OpenFigs.fig vector into svg or a fidelity report", () => {
    const fig = parseFig(fixture("OpenFigs.fig"));
    const { ir } = buildFigIR(fig);
    const result = mapFig(ir);
    const hasSvg = Object.values(result.nodes).some((n) => n.kind === "svg");
    const reported = result.report.some((entry) => entry.type === "VECTOR");
    expect(hasSvg || reported).toBe(true);
  });

  it("never drops brush nodes silently: each is mapped or reported", () => {
    const fig = parseFig(fixture("coloradjusted.fig"));
    const { ir } = buildFigIR(fig);
    const result = mapFig(ir);
    const brushes = ir.nodes.filter((n) => n.type === "BRUSH");
    expect(brushes.length).toBeGreaterThan(0);
    for (const brush of brushes) {
      const accounted =
        Boolean(result.nodes[brush.id]) || result.report.some((entry) => entry.nodeId === brush.id);
      expect(accounted).toBe(true);
    }
  });
});
