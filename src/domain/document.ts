export interface FlexLayout {
  dir: "h" | "v";
  gap: number;
  pad: [number, number, number, number];
  align: "start" | "center" | "end" | "stretch";
  justify: "start" | "center" | "end" | "between" | "around";
}

export interface BaseNode {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hidden?: boolean;
  opacity?: number;
  boxShadow?: string;
  filter?: string;
  backdropFilter?: string;
}

export interface FrameNode extends BaseNode {
  kind: "frame";
  flex: FlexLayout | null;
  clip: boolean;
  fill?: string;
  stroke?: string;
  radius?: number;
  children: string[];
}

export interface InstanceNode extends BaseNode {
  kind: "instance";
  componentId: string;
  overrides: Record<string, unknown>;
  className?: string;
  detached?: boolean;
}

export interface ShapeNode extends BaseNode {
  kind: "shape";
  shape: "rect" | "ellipse";
  fill?: string;
  stroke?: string;
  radius?: number;
}

export interface TextNode extends BaseNode {
  kind: "text";
  content: string;
  size: number;
  weight: number;
  color: string;
  align: "left" | "center" | "right";
}

export interface SvgNode extends BaseNode {
  kind: "svg";
  svg: string;
}

export type DocNode = FrameNode | InstanceNode | ShapeNode | TextNode | SvgNode;

export interface Document {
  id: string;
  name: string;
  nodes: Record<string, DocNode>;
  roots: string[];
}

export type DocAction =
  | { type: "insert"; node: DocNode; parentId?: string; index?: number }
  | { type: "move"; ids: string[]; dx: number; dy: number }
  | { type: "resize"; id: string; w: number; h: number }
  | { type: "set"; id: string; patch: Partial<DocNode> }
  | { type: "remove"; ids: string[] }
  | { type: "duplicate"; ids: string[] }
  | { type: "group"; ids: string[]; name: string }
  | { type: "ungroup"; id: string }
  | {
      type: "align";
      ids: string[];
      mode: "left" | "right" | "top" | "bottom" | "hcenter" | "vcenter";
    }
  | { type: "distribute"; ids: string[]; axis: "h" | "v" }
  | { type: "reorder"; id: string; parentId: string | null; index: number }
  | { type: "merge"; nodes: Record<string, DocNode>; roots: string[] };

export function emptyDocument(id: string, name: string): Document {
  return { id, name, nodes: {}, roots: [] };
}

function parentOf(doc: Document, id: string): string | null {
  for (const node of Object.values(doc.nodes)) {
    if (node.kind === "frame" && node.children.includes(id)) return node.id;
  }
  return null;
}

function siblings(doc: Document, id: string): string[] {
  const parent = parentOf(doc, id);
  return parent ? (doc.nodes[parent] as FrameNode).children : doc.roots;
}

function clone(doc: Document): Document {
  return { ...doc, nodes: { ...doc.nodes }, roots: [...doc.roots] };
}

export function reduce(doc: Document, action: DocAction): Document {
  const next = clone(doc);
  switch (action.type) {
    case "insert": {
      next.nodes[action.node.id] = action.node;
      if (action.parentId) {
        const parent = next.nodes[action.parentId] as FrameNode;
        const children = [...parent.children];
        children.splice(action.index ?? children.length, 0, action.node.id);
        next.nodes[action.parentId] = { ...parent, children };
      } else {
        next.roots.splice(action.index ?? next.roots.length, 0, action.node.id);
      }
      return next;
    }
    case "move": {
      for (const id of action.ids) {
        const node = next.nodes[id];
        if (node) next.nodes[id] = { ...node, x: node.x + action.dx, y: node.y + action.dy };
      }
      return next;
    }
    case "resize": {
      const node = next.nodes[action.id];
      if (node)
        next.nodes[action.id] = { ...node, w: Math.max(8, action.w), h: Math.max(8, action.h) };
      return next;
    }
    case "set": {
      const node = next.nodes[action.id];
      if (node) next.nodes[action.id] = { ...node, ...action.patch } as DocNode;
      return next;
    }
    case "remove": {
      const drop = (id: string) => {
        const node = next.nodes[id];
        if (node?.kind === "frame") node.children.forEach(drop);
        delete next.nodes[id];
      };
      action.ids.forEach(drop);
      next.roots = next.roots.filter((id) => !action.ids.includes(id));
      for (const node of Object.values(next.nodes)) {
        if (node.kind === "frame")
          node.children = node.children.filter((id) => !action.ids.includes(id));
      }
      return next;
    }
    case "duplicate": {
      const map = new Map<string, string>();
      const copy = (id: string): string => {
        const node = next.nodes[id];
        const newId = crypto.randomUUID();
        map.set(id, newId);
        const copied = { ...node, id: newId, x: node.x + 24, y: node.y + 24 } as DocNode;
        if (node.kind === "frame" && copied.kind === "frame")
          copied.children = node.children.map(copy);
        next.nodes[newId] = copied;
        return newId;
      };
      const newIds = action.ids.map(copy);
      const parent = parentOf(doc, action.ids[0]);
      if (parent) {
        const parentNode = next.nodes[parent] as FrameNode;
        next.nodes[parent] = { ...parentNode, children: [...parentNode.children, ...newIds] };
      } else {
        next.roots.push(...newIds);
      }
      return next;
    }
    case "group": {
      const members = action.ids.map((id) => next.nodes[id]).filter(Boolean);
      if (members.length === 0) return doc;
      const x = Math.min(...members.map((n) => n.x));
      const y = Math.min(...members.map((n) => n.y));
      const frame: FrameNode = {
        id: crypto.randomUUID(),
        kind: "frame",
        name: action.name,
        x,
        y,
        w: Math.max(...members.map((n) => n.x + n.w)) - x,
        h: Math.max(...members.map((n) => n.y + n.h)) - y,
        flex: null,
        clip: false,
        children: action.ids,
      };
      next.nodes[frame.id] = frame;
      const parent = parentOf(doc, action.ids[0]);
      if (parent) {
        const parentNode = next.nodes[parent] as FrameNode;
        next.nodes[parent] = {
          ...parentNode,
          children: parentNode.children
            .map((id) => (action.ids.includes(id) ? frame.id : id))
            .filter((id, i, arr) => arr.indexOf(id) === i),
        };
      } else {
        next.roots = next.roots
          .map((id) => (action.ids.includes(id) ? frame.id : id))
          .filter((id, i, arr) => arr.indexOf(id) === i);
      }
      for (const id of action.ids) {
        const node = next.nodes[id];
        next.nodes[id] = { ...node, x: node.x - x, y: node.y - y };
      }
      return next;
    }
    case "ungroup": {
      const frame = next.nodes[action.id];
      if (frame?.kind !== "frame") return doc;
      const parent = parentOf(doc, action.id);
      const list = parent ? (next.nodes[parent] as FrameNode).children : next.roots;
      const index = list.indexOf(action.id);
      const lifted = frame.children.map((id) => {
        const node = next.nodes[id];
        next.nodes[id] = { ...node, x: node.x + frame.x, y: node.y + frame.y };
        return id;
      });
      list.splice(index, 1, ...lifted);
      if (parent) next.nodes[parent] = { ...(next.nodes[parent] as FrameNode), children: list };
      else next.roots = list;
      delete next.nodes[action.id];
      return next;
    }
    case "align": {
      const members = action.ids.map((id) => next.nodes[id]).filter(Boolean);
      if (members.length < 2) return doc;
      const minX = Math.min(...members.map((n) => n.x));
      const maxX = Math.max(...members.map((n) => n.x + n.w));
      const minY = Math.min(...members.map((n) => n.y));
      const maxY = Math.max(...members.map((n) => n.y + n.h));
      for (const node of members) {
        let { x, y } = node;
        if (action.mode === "left") x = minX;
        if (action.mode === "right") x = maxX - node.w;
        if (action.mode === "top") y = minY;
        if (action.mode === "bottom") y = maxY - node.h;
        if (action.mode === "hcenter") x = (minX + maxX) / 2 - node.w / 2;
        if (action.mode === "vcenter") y = (minY + maxY) / 2 - node.h / 2;
        next.nodes[node.id] = { ...node, x, y };
      }
      return next;
    }
    case "distribute": {
      const members = action.ids
        .map((id) => next.nodes[id])
        .filter(Boolean)
        .sort((a, b) => (action.axis === "h" ? a.x - b.x : a.y - b.y));
      if (members.length < 3) return doc;
      const first = members[0];
      const last = members[members.length - 1];
      const total = action.axis === "h" ? last.x + last.w - first.x : last.y + last.h - first.y;
      const sizes = members.reduce((sum, n) => sum + (action.axis === "h" ? n.w : n.h), 0);
      const gap = (total - sizes) / (members.length - 1);
      let cursor = action.axis === "h" ? first.x : first.y;
      for (const node of members) {
        next.nodes[node.id] = action.axis === "h" ? { ...node, x: cursor } : { ...node, y: cursor };
        cursor += (action.axis === "h" ? node.w : node.h) + gap;
      }
      return next;
    }
    case "merge": {
      Object.assign(next.nodes, action.nodes);
      next.roots.push(...action.roots.filter((id) => !next.roots.includes(id)));
      return next;
    }
    case "reorder": {
      const oldParent = parentOf(doc, action.id);
      const oldList = oldParent ? (next.nodes[oldParent] as FrameNode).children : next.roots;
      const filtered = oldList.filter((id) => id !== action.id);
      if (oldParent)
        next.nodes[oldParent] = { ...(next.nodes[oldParent] as FrameNode), children: filtered };
      else next.roots = filtered;
      const newList = action.parentId
        ? (next.nodes[action.parentId] as FrameNode).children
        : next.roots;
      const inserted = [...newList];
      inserted.splice(action.index, 0, action.id);
      if (action.parentId)
        next.nodes[action.parentId] = {
          ...(next.nodes[action.parentId] as FrameNode),
          children: inserted,
        };
      else next.roots = inserted;
      return next;
    }
  }
}

export function nodeAt(doc: Document, id: string): DocNode | undefined {
  return doc.nodes[id];
}

export function descendants(doc: Document, id: string): string[] {
  const node = doc.nodes[id];
  if (node?.kind !== "frame") return [id];
  return [id, ...node.children.flatMap((child) => descendants(doc, child))];
}

export { parentOf, siblings };
