import { describe, expect, it } from "vite-plus/test";
import {
  emptyDocument,
  reduce,
  type Document,
  type FrameNode,
  type ShapeNode,
} from "../../src/domain/document";

const shape = (id: string, x: number, y: number, w = 50, h = 50): ShapeNode => ({
  id,
  kind: "shape",
  shape: "rect",
  name: id,
  x,
  y,
  w,
  h,
  fill: "#000",
});

describe("docReducer", () => {
  it("inserts into roots and frames", () => {
    let doc = emptyDocument("d", "test");
    doc = reduce(doc, { type: "insert", node: shape("a", 0, 0) });
    doc = reduce(doc, {
      type: "insert",
      node: {
        id: "f",
        kind: "frame",
        name: "f",
        x: 0,
        y: 0,
        w: 200,
        h: 200,
        flex: null,
        clip: true,
        children: [],
      },
    });
    doc = reduce(doc, { type: "insert", node: shape("b", 10, 10), parentId: "f" });
    expect(doc.roots).toEqual(["a", "f"]);
    expect((doc.nodes.f as FrameNode).children).toEqual(["b"]);
  });

  it("moves, resizes, duplicates and removes", () => {
    let doc = emptyDocument("d", "test");
    doc = reduce(doc, { type: "insert", node: shape("a", 0, 0) });
    doc = reduce(doc, { type: "move", ids: ["a"], dx: 10, dy: -5 });
    expect(doc.nodes.a.x).toBe(10);
    expect(doc.nodes.a.y).toBe(-5);
    doc = reduce(doc, { type: "resize", id: "a", w: 100, h: 80 });
    expect(doc.nodes.a.w).toBe(100);
    doc = reduce(doc, { type: "duplicate", ids: ["a"] });
    expect(doc.roots.length).toBe(2);
    doc = reduce(doc, { type: "remove", ids: [doc.roots[1]] });
    expect(doc.roots.length).toBe(1);
  });

  it("groups and ungroups preserving world positions", () => {
    let doc = emptyDocument("d", "test");
    doc = reduce(doc, { type: "insert", node: shape("a", 100, 100) });
    doc = reduce(doc, { type: "insert", node: shape("b", 200, 150) });
    doc = reduce(doc, { type: "group", ids: ["a", "b"], name: "g" });
    const groupId = doc.roots[0];
    const group = doc.nodes[groupId] as FrameNode;
    expect(group.x).toBe(100);
    expect(group.y).toBe(100);
    expect(doc.nodes.a.x).toBe(0);
    expect(doc.nodes.b.x).toBe(100);
    doc = reduce(doc, { type: "ungroup", id: groupId });
    expect(doc.nodes.a.x).toBe(100);
    expect(doc.nodes.b.x).toBe(200);
    expect(doc.roots).toEqual(["a", "b"]);
  });

  it("aligns and distributes", () => {
    let doc = emptyDocument("d", "test");
    doc = reduce(doc, { type: "insert", node: shape("a", 0, 0, 50, 50) });
    doc = reduce(doc, { type: "insert", node: shape("b", 100, 20, 50, 50) });
    doc = reduce(doc, { type: "insert", node: shape("c", 300, 40, 50, 50) });
    doc = reduce(doc, { type: "align", ids: ["a", "b", "c"], mode: "top" });
    expect(doc.nodes.b.y).toBe(0);
    doc = reduce(doc, { type: "distribute", ids: ["a", "b", "c"], axis: "h" });
    const gap1 = doc.nodes.b.x - (doc.nodes.a.x + doc.nodes.a.w);
    const gap2 = doc.nodes.c.x - (doc.nodes.b.x + doc.nodes.b.w);
    expect(Math.abs(gap1 - gap2)).toBeLessThan(0.001);
  });

  it("merges fragments without duplicating roots", () => {
    let doc = emptyDocument("d", "test");
    doc = reduce(doc, { type: "insert", node: shape("a", 0, 0) });
    const fragment: Document = { id: "x", name: "x", nodes: { b: shape("b", 5, 5) }, roots: ["b"] };
    doc = reduce(doc, { type: "merge", nodes: fragment.nodes, roots: fragment.roots });
    doc = reduce(doc, { type: "merge", nodes: fragment.nodes, roots: fragment.roots });
    expect(doc.roots).toEqual(["a", "b"]);
  });
});
