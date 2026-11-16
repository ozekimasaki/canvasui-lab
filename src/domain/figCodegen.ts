import type { DocNode } from "./document";
import type { FigComponentDef } from "./figmap";

function pascal(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9]+/g, " ").trim();
  const pascalCase =
    cleaned
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("") || "ImportedComponent";
  return /^[A-Za-z]/.test(pascalCase) ? pascalCase : `C${pascalCase}`;
}

function styleLiteral(node: DocNode): string {
  const entries: string[] = [];
  if (node.kind === "frame") {
    if (node.fill) entries.push(`background: ${JSON.stringify(node.fill)}`);
    if (node.stroke) entries.push(`border: ${JSON.stringify(`1px solid ${node.stroke}`)}`);
    if (node.radius) entries.push(`borderRadius: ${node.radius}`);
    if (node.clip) entries.push(`overflow: "hidden"`);
    if (node.flex) {
      entries.push(
        `display: "flex"`,
        `flexDirection: ${node.flex.dir === "h" ? '"row"' : '"column"'}`,
        `gap: ${node.flex.gap}`,
        `padding: ${JSON.stringify(node.flex.pad.map((v) => `${v}px`).join(" "))}`,
      );
    }
  }
  if (node.kind === "shape") {
    entries.push(`background: ${JSON.stringify(node.fill ?? "#d9d9d9")}`);
    if (node.shape === "ellipse") entries.push(`borderRadius: "50%"`);
    else if (node.radius) entries.push(`borderRadius: ${node.radius}`);
  }
  if (node.kind === "text") {
    entries.push(
      `color: ${JSON.stringify(node.color)}`,
      `fontSize: ${node.size}`,
      `fontWeight: ${node.weight}`,
      `textAlign: ${JSON.stringify(node.align)}`,
    );
  }
  return entries.length ? `{ ${entries.join(", ")} }` : "undefined";
}

function renderNode(
  node: DocNode,
  nodes: Record<string, DocNode>,
  propKeys: Set<string>,
  depth: number,
): string {
  const pad = "  ".repeat(depth);
  const prop = propKeys.has(node.name) ? node.name.replace(/[^A-Za-z0-9]/g, "_") : null;
  if (node.kind === "text") {
    const content = prop
      ? `{String(${prop} ?? ${JSON.stringify(node.content)})}`
      : JSON.stringify(node.content);
    return `${pad}<span style={${styleLiteral(node)}}>${content}</span>`;
  }
  if (node.kind === "svg") {
    return `${pad}<div style={${styleLiteral(node)}} dangerouslySetInnerHTML={{ __html: ${JSON.stringify(node.svg)} }} />`;
  }
  if (node.kind === "instance") {
    return `${pad}<div data-component={${JSON.stringify(node.componentId)}} style={{ width: ${node.w}, height: ${node.h} }} />`;
  }
  if (node.kind === "shape") {
    return `${pad}<div style={{ width: ${node.w}, height: ${node.h}, ...${styleLiteral(node)} }} />`;
  }
  const children = node.children
    .map((id) => nodes[id])
    .filter(Boolean)
    .map((child) => renderNode(child, nodes, propKeys, depth + 1))
    .join("\n");
  const size = node.flex ? "" : ` width: ${node.w}, height: ${node.h},`;
  return `${pad}<div style={{${size} position: "relative", ...${styleLiteral(node)} }}>
${children}
${pad}</div>`;
}

export function generateComponentCode(
  def: FigComponentDef,
  nodes: Record<string, DocNode>,
): string {
  const name = pascal(def.name);
  const root = nodes[def.rootId];
  const propKeys = new Set(def.propKeys.map((key) => key.replace(/[^A-Za-z0-9]/g, "_")));
  const propsInterface = [...propKeys]
    .map((key) => `  ${key}?: string | number | boolean;`)
    .join("\n");
  const destructured = [...propKeys].join(", ");
  const body = root ? renderNode(root, nodes, new Set(def.propKeys), 2) : "    <div />";
  return `export interface ${name}Props {
${propsInterface}
  className?: string;
}

export function ${name}({ ${destructured}${destructured ? ", " : ""}className }: ${name}Props) {
  return (
    <div className={className} style={{ position: "relative" }}>
${body}
    </div>
  );
}

export default ${name};
`;
}

export { pascal };
