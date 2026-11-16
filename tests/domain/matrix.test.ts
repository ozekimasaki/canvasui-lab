import { describe, expect, it } from "vite-plus/test";
import type { ValidatedComponentSpec } from "../../src/domain/brands";
import { cartesian, cellKeyFor, fnv1a, layoutMatrix, matrixBounds } from "../../src/domain/matrix";

function spec(axes: Record<string, string[]>): ValidatedComponentSpec {
  return {
    id: "button",
    title: "Button",
    filePath: "src/components/Button/Button.stories.tsx",
    axes,
    defaultArgs: { label: "Click" },
  } as unknown as ValidatedComponentSpec;
}

describe("cartesian", () => {
  it("expands the full direct product", () => {
    const combos = cartesian({ size: ["sm", "md", "lg"], theme: ["light", "dark"] });
    expect(combos).toHaveLength(6);
    expect(combos).toContainEqual({ size: "md", theme: "dark" });
  });
  it("returns one empty combo for no axes", () => {
    expect(cartesian({})).toEqual([{}]);
  });
});

describe("cellKey", () => {
  it("is stable regardless of axis insertion order", () => {
    const a = cellKeyFor("button", { size: "md", theme: "dark" });
    const b = cellKeyFor("button", { theme: "dark", size: "md" });
    expect(a).toBe(b);
  });
  it("differs across values and components", () => {
    expect(cellKeyFor("button", { size: "md" })).not.toBe(cellKeyFor("button", { size: "lg" }));
    expect(cellKeyFor("button", { size: "md" })).not.toBe(cellKeyFor("input", { size: "md" }));
  });
  it("fnv1a is deterministic", () => {
    expect(fnv1a("abc")).toBe(fnv1a("abc"));
    expect(fnv1a("abc")).not.toBe(fnv1a("abd"));
  });
});

describe("layoutMatrix", () => {
  const cells = layoutMatrix([spec({ size: ["sm", "md", "lg"], theme: ["light", "dark"] })]);

  it("creates one cell per combination", () => {
    expect(cells).toHaveLength(6);
  });
  it("merges axis values into args over defaults", () => {
    const cell = cells.find((c) => c.axisValues.size === "md" && c.axisValues.theme === "dark");
    expect(cell?.args).toEqual({ label: "Click", size: "md", theme: "dark" });
  });
  it("never overlaps cells", () => {
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i];
        const b = cells[j];
        const overlap =
          a.x < b.x + b.width &&
          b.x < a.x + a.width &&
          a.y < b.y + b.height &&
          b.y < a.y + a.height;
        expect(overlap).toBe(false);
      }
    }
  });
  it("computes bounds covering every cell", () => {
    const bounds = matrixBounds(cells);
    for (const cell of cells) {
      expect(cell.x + cell.width).toBeLessThanOrEqual(bounds.width);
      expect(cell.y + cell.height).toBeLessThanOrEqual(bounds.height);
    }
  });
  it("stacks extra axes as separate blocks", () => {
    const threeAxis = layoutMatrix([
      spec({ size: ["sm", "md"], state: ["default", "disabled"], theme: ["light", "dark"] }),
    ]);
    expect(threeAxis).toHaveLength(8);
    const ys = new Set(threeAxis.map((c) => c.y));
    expect(ys.size).toBeGreaterThan(2);
  });
});
