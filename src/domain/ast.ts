import type { SourceEdit } from "./brands";

export type { SourceEdit } from "./brands";

export interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

export interface AnchorSpec {
  kind: "jsx-attribute" | "jsx-text" | "string-literal" | "default-param";
  component?: string;
  element?: string;
  name?: string;
  occurrence?: number;
}

export const MAX_EDITS = 40;
export const WRITEBACK_ALLOWLIST = /^src\/components\/[A-Za-z0-9_./-]+\.tsx$/;

const LEAF_TYPES = new Set([
  "Literal",
  "JSXText",
  "Identifier",
  "PrivateIdentifier",
  "JSXIdentifier",
]);

function isNode(value: unknown): value is AstNode {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as AstNode).type === "string" &&
    typeof (value as AstNode).start === "number" &&
    typeof (value as AstNode).end === "number"
  );
}

export function walk(
  node: AstNode,
  visit: (node: AstNode, parent: AstNode | null) => void,
  parent: AstNode | null = null,
): void {
  visit(node, parent);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) walk(item, visit, node);
    } else if (isNode(value)) {
      walk(value, visit, node);
    }
  }
}

function nameOf(node: unknown): string {
  if (!isNode(node)) return "";
  if (typeof node.name === "string") return node.name;
  if (isNode(node.name)) return nameOf(node.name);
  if (isNode(node.id)) return nameOf(node.id);
  if (isNode(node.key)) return nameOf(node.key);
  return "";
}

export function keyOf(node: AstNode): string {
  switch (node.type) {
    case "JSXElement":
      return `JSXElement:${nameOf(node.openingElement)}`;
    case "JSXAttribute":
      return `JSXAttribute:${nameOf(node.name)}`;
    case "FunctionDeclaration":
    case "VariableDeclarator":
    case "ClassDeclaration":
    case "Property":
    case "MethodDefinition":
      return `${node.type}:${nameOf(node)}`;
    default:
      return node.type;
  }
}

function childArrays(node: AstNode): [string, AstNode[]][] {
  const out: [string, AstNode[]][] = [];
  for (const [field, value] of Object.entries(node)) {
    if (Array.isArray(value) && value.some(isNode)) {
      out.push([field, value.filter(isNode)]);
    }
  }
  return out;
}

function childNodes(node: AstNode): [string, AstNode][] {
  const out: [string, AstNode][] = [];
  for (const [field, value] of Object.entries(node)) {
    if (isNode(value)) out.push([field, value]);
  }
  return out;
}

function insertionPoint(oldNode: AstNode, oldSource: string, prev: AstNode | null): number {
  if (prev) return prev.end;
  if (oldNode.type === "JSXElement") {
    const closing = oldSource.lastIndexOf("</", oldNode.end - 1);
    if (closing > oldNode.start) return closing;
  }
  return oldNode.end;
}

function diffNodes(
  oldNode: AstNode,
  newNode: AstNode,
  oldSource: string,
  newSource: string,
  edits: SourceEdit[],
): boolean {
  if (keyOf(oldNode) !== keyOf(newNode)) return false;
  if (LEAF_TYPES.has(oldNode.type)) {
    const before = oldSource.slice(oldNode.start, oldNode.end);
    const after = newSource.slice(newNode.start, newNode.end);
    if (before !== after)
      edits.push({ start: oldNode.start, end: oldNode.end, replacement: after });
    return true;
  }
  for (const [field, oldItems] of childArrays(oldNode)) {
    const newItems = (newNode[field] as unknown[] | undefined)?.filter(isNode) ?? [];
    const queue = [...newItems];
    let prev: AstNode | null = null;
    for (const oldItem of oldItems) {
      const index = queue.findIndex((candidate) => keyOf(candidate) === keyOf(oldItem));
      if (index === -1) {
        edits.push({ start: oldItem.start, end: oldItem.end, replacement: "" });
        continue;
      }
      const [matched] = queue.splice(index, 1);
      if (!diffNodes(oldItem, matched, oldSource, newSource, edits)) return false;
      prev = oldItem;
    }
    for (const inserted of queue) {
      const at = insertionPoint(oldNode, oldSource, prev);
      edits.push({
        start: at,
        end: at,
        replacement: newSource.slice(inserted.start, inserted.end),
      });
      prev = inserted;
    }
  }
  for (const [field, oldChild] of childNodes(oldNode)) {
    const newChild = newNode[field];
    if (isNode(newChild)) {
      if (!diffNodes(oldChild, newChild, oldSource, newSource, edits)) return false;
    }
  }
  return true;
}

export function diffAst(
  oldRoot: AstNode,
  newRoot: AstNode,
  oldSource: string,
  newSource: string,
): SourceEdit[] | null {
  const edits: SourceEdit[] = [];
  if (!diffNodes(oldRoot, newRoot, oldSource, newSource, edits)) return null;
  const meaningful = edits.filter((edit) => edit.start !== edit.end || edit.replacement !== "");
  if (meaningful.length === 0 || meaningful.length > MAX_EDITS) return null;
  return meaningful.sort((a, b) => a.start - b.start);
}

export function applyEdits(source: string, edits: readonly SourceEdit[]): string | null {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let cursor = source.length + 1;
  let out = source;
  for (const edit of sorted) {
    if (edit.start < 0 || edit.end > source.length || edit.start > edit.end) return null;
    if (edit.end > cursor) return null;
    out = out.slice(0, edit.start) + edit.replacement + out.slice(edit.end);
    cursor = edit.start;
  }
  return out;
}

function inComponent(node: AstNode, component: string | undefined, root: AstNode): boolean {
  if (!component) return true;
  let found = false;
  walk(root, (candidate) => {
    if (
      (candidate.type === "FunctionDeclaration" || candidate.type === "VariableDeclarator") &&
      nameOf(candidate) === component
    ) {
      walk(candidate, (inner) => {
        if (inner === node) found = true;
      });
    }
  });
  return found;
}

function inElement(node: AstNode, element: string | undefined, root: AstNode): boolean {
  if (!element) return true;
  let found = false;
  walk(root, (candidate) => {
    if (candidate.type === "JSXElement" && nameOf(candidate.openingElement) === element) {
      walk(candidate, (inner) => {
        if (inner === node) found = true;
      });
    }
  });
  return found;
}

export function resolveAnchor(root: AstNode, source: string, spec: AnchorSpec): AstNode[] {
  const matches: AstNode[] = [];
  walk(root, (node) => {
    if (!inComponent(node, spec.component, root) || !inElement(node, spec.element, root)) return;
    switch (spec.kind) {
      case "jsx-attribute":
        if (node.type === "JSXAttribute" && nameOf(node.name) === spec.name) matches.push(node);
        break;
      case "jsx-text":
        if (node.type === "JSXText" && source.slice(node.start, node.end).trim() === spec.name)
          matches.push(node);
        break;
      case "string-literal":
        if (node.type === "Literal" && typeof node.value === "string" && node.value === spec.name)
          matches.push(node);
        break;
      case "default-param":
        if (node.type === "AssignmentPattern" && nameOf(node.left) === spec.name)
          matches.push(node);
        break;
    }
  });
  if (spec.occurrence !== undefined) {
    const picked = matches[spec.occurrence];
    return picked ? [picked] : [];
  }
  return matches;
}

export function exportNames(root: AstNode): Set<string> {
  const names = new Set<string>();
  const body = root.body;
  if (!Array.isArray(body)) return names;
  for (const statement of body) {
    if (!isNode(statement)) continue;
    if (statement.type === "ExportDefaultDeclaration") names.add("default");
    if (statement.type === "ExportNamedDeclaration") {
      const declaration = statement.declaration;
      if (isNode(declaration)) names.add(nameOf(declaration));
      const specifiers = statement.specifiers;
      if (Array.isArray(specifiers)) {
        for (const specifier of specifiers)
          if (isNode(specifier)) names.add(nameOf(specifier.exported));
      }
    }
  }
  return names;
}

export interface PatchRuleInput {
  filePath: string;
  baseHash: string;
  currentHash: string;
  oldRoot: AstNode;
  newRoot: AstNode;
  edits: readonly SourceEdit[];
}

export function validatePatchRules(input: PatchRuleInput): string | null {
  if (!WRITEBACK_ALLOWLIST.test(input.filePath) || input.filePath.includes("..")) {
    return "filePath is outside the write-back allowlist (src/components/**/*.tsx)";
  }
  if (input.baseHash !== input.currentHash) {
    return "baseHash does not match current file content (concurrent edit)";
  }
  if (input.edits.length === 0 || input.edits.length > MAX_EDITS) {
    return `edit count must be 1..${MAX_EDITS}`;
  }
  const before = exportNames(input.oldRoot);
  const after = exportNames(input.newRoot);
  for (const name of before) {
    if (!after.has(name)) return `patch would remove export "${name}"`;
  }
  return null;
}
