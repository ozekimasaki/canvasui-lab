import { parse as babelParse } from "@babel/parser";
import { describe, expect, it } from "vite-plus/test";
import {
  applyEdits,
  diffAst,
  exportNames,
  resolveAnchor,
  validatePatchRules,
  type AstNode,
} from "../../src/domain/ast";

const parse = (source: string): AstNode => {
  const file = babelParse(source, {
    sourceType: "module",
    plugins: ["typescript", "jsx", "estree"],
  }) as unknown as { program?: AstNode };
  return file.program ?? (file as unknown as AstNode);
};

const OLD = `export function Button({ label = "Continue" }) {
  return <button data-component="Button">{label}</button>;
}
export default Button;
`;

describe("AST diff + apply", () => {
  it("derives a single edit for a literal change and round-trips", () => {
    const next = OLD.replace('"Continue"', '"Submit"');
    const edits = diffAst(parse(OLD), parse(next), OLD, next);
    expect(edits).not.toBeNull();
    expect(edits).toHaveLength(1);
    expect(applyEdits(OLD, edits ?? [])).toBe(next);
  });

  it("handles JSX child insertion", () => {
    const next = OLD.replace("{label}</button>", "{label}<span>hi</span></button>");
    const edits = diffAst(parse(OLD), parse(next), OLD, next);
    expect(edits).not.toBeNull();
    expect(applyEdits(OLD, edits ?? [])).toBe(next);
  });

  it("handles JSX child deletion", () => {
    const withSpan = OLD.replace("{label}</button>", "{label}<span>hi</span></button>");
    const edits = diffAst(parse(withSpan), parse(OLD), withSpan, OLD);
    expect(edits).not.toBeNull();
    expect(applyEdits(withSpan, edits ?? [])).toBe(OLD);
  });

  it("rejects overlapping edits", () => {
    expect(
      applyEdits(OLD, [
        { start: 0, end: 10, replacement: "x" },
        { start: 5, end: 12, replacement: "y" },
      ]),
    ).toBeNull();
  });
});

describe("anchors", () => {
  it("resolves a unique JSX attribute", () => {
    const matches = resolveAnchor(parse(OLD), OLD, {
      kind: "jsx-attribute",
      name: "data-component",
    });
    expect(matches).toHaveLength(1);
  });
  it("resolves a unique default param", () => {
    const matches = resolveAnchor(parse(OLD), OLD, {
      kind: "default-param",
      component: "Button",
      name: "label",
    });
    expect(matches).toHaveLength(1);
  });
  it("returns empty for unknown anchors", () => {
    expect(resolveAnchor(parse(OLD), OLD, { kind: "jsx-attribute", name: "nope" })).toHaveLength(0);
  });
});

describe("patch rules", () => {
  const base = {
    filePath: "src/components/Button/Button.tsx",
    baseHash: "h1",
    currentHash: "h1",
    oldRoot: parse(OLD),
    newRoot: parse(OLD),
    edits: [{ start: 0, end: 0, replacement: "" }],
  };
  it("accepts a valid patch", () => {
    expect(validatePatchRules(base)).toBeNull();
  });
  it("rejects paths outside the allowlist", () => {
    expect(validatePatchRules({ ...base, filePath: "src/factory/index.ts" })).toMatch(/allowlist/);
    expect(validatePatchRules({ ...base, filePath: "src/components/../../env.ts" })).toMatch(
      /allowlist/,
    );
  });
  it("rejects concurrent edits via baseHash", () => {
    expect(validatePatchRules({ ...base, currentHash: "h2" })).toMatch(/concurrent/);
  });
  it("rejects export removal", () => {
    const stripped = OLD.replace("export default Button;\n", "");
    expect(exportNames(parse(OLD)).has("default")).toBe(true);
    expect(validatePatchRules({ ...base, newRoot: parse(stripped) })).toMatch(/export/);
  });
});
