import { parse as babelParse } from "@babel/parser";
import { z } from "zod";
import {
  applyEdits,
  diffAst,
  resolveAnchor,
  validatePatchRules,
  WRITEBACK_ALLOWLIST,
  type AstNode,
  type SourceEdit,
} from "../domain/ast";
import type { ValidatedASTPatch } from "../domain/brands";
import { sha256Hex } from "../domain/snapshot";
import type { McpRepo } from "../repository/mcpRepo";
import type { SourceRepo } from "../repository/sourceRepo";
import { ServiceError } from "./errors";

function parse(content: string): AstNode {
  const file = babelParse(content, {
    sourceType: "module",
    plugins: ["typescript", "jsx", "estree"],
  }) as unknown as { program?: AstNode };
  return file.program ?? (file as unknown as AstNode);
}

async function hashOf(content: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(content));
}

const editSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  replacement: z.string(),
});

const proposeSchema = z.object({
  filePath: z.string().min(1),
  baseHash: z.string().optional(),
  content: z.string().optional(),
  edits: z.array(editSchema).optional(),
  anchor: z
    .object({
      kind: z.enum(["jsx-attribute", "jsx-text", "string-literal", "default-param"]),
      component: z.string().optional(),
      element: z.string().optional(),
      name: z.string().optional(),
      occurrence: z.number().int().nonnegative().optional(),
      value: z.union([z.string(), z.number(), z.boolean()]).optional(),
    })
    .optional(),
});

const applySchema = z.object({
  filePath: z.string().min(1),
  baseHash: z.string().min(1),
  afterHash: z.string().min(1),
  edits: z.array(editSchema).min(1),
  author: z.enum(["gui", "ai", "mcp"]).default("gui"),
});

export function createSourceService(deps: { source: SourceRepo; patches: McpRepo }) {
  const read = async (filePath: string) => {
    if (!WRITEBACK_ALLOWLIST.test(filePath) || filePath.includes("..")) {
      throw new ServiceError("filePath is outside the write-back allowlist");
    }
    const file = await deps.source.read(filePath);
    if (!file) throw new ServiceError(`source file not found: ${filePath}`, 404);
    return { filePath, content: file.content, hash: await hashOf(file.content) };
  };

  const buildPatch = async (input: z.infer<typeof proposeSchema>) => {
    const current = await read(input.filePath);
    const baseHash = input.baseHash ?? current.hash;
    const oldRoot = parse(current.content);
    let edits: SourceEdit[];
    if (input.anchor) {
      const matches = resolveAnchor(oldRoot, current.content, input.anchor);
      if (matches.length !== 1) {
        throw new ServiceError(`anchor resolved to ${matches.length} nodes (must be exactly 1)`);
      }
      const node = matches[0];
      const value = input.anchor.value;
      if (value === undefined) throw new ServiceError("anchor edit requires a value");
      const rendered =
        input.anchor.kind === "jsx-attribute"
          ? typeof value === "string"
            ? `${input.anchor.name}=${JSON.stringify(value)}`
            : `${input.anchor.name}={${String(value)}}`
          : typeof value === "string"
            ? JSON.stringify(value)
            : String(value);
      edits = [{ start: node.start, end: node.end, replacement: rendered }];
    } else if (input.edits) {
      edits = input.edits;
    } else if (input.content !== undefined) {
      let newRoot: AstNode;
      try {
        newRoot = parse(input.content);
      } catch (error) {
        throw new ServiceError(
          `proposed content does not parse: ${error instanceof Error ? error.message : ""}`,
        );
      }
      const diffed = diffAst(oldRoot, newRoot, current.content, input.content);
      if (!diffed) {
        throw new ServiceError("change is too complex for a safe AST diff; use smaller edits");
      }
      edits = diffed;
    } else {
      throw new ServiceError("provide content, edits, or anchor");
    }

    const next = applyEdits(current.content, edits);
    if (next === null) throw new ServiceError("edit ranges are invalid or overlapping");
    let newRoot: AstNode;
    try {
      newRoot = parse(next);
    } catch (error) {
      throw new ServiceError(
        `patched source does not parse: ${error instanceof Error ? error.message : ""}`,
      );
    }
    const ruleError = validatePatchRules({
      filePath: input.filePath,
      baseHash,
      currentHash: current.hash,
      oldRoot,
      newRoot,
      edits,
    });
    if (ruleError) {
      throw new ServiceError(ruleError, ruleError.includes("concurrent") ? 409 : 400);
    }
    const patch = {
      filePath: input.filePath,
      baseHash,
      afterHash: await hashOf(next),
      edits,
    } as unknown as ValidatedASTPatch;
    return { patch, preview: next };
  };

  return {
    read,
    async propose(input: unknown) {
      const parsed = proposeSchema.parse(input);
      const { patch, preview } = await buildPatch(parsed);
      return { patch, preview };
    },
    async apply(input: unknown) {
      const parsed = applySchema.parse(input);
      // Re-validate server-side: the client-supplied patch is never trusted as a passport.
      const { patch } = await buildPatch({
        filePath: parsed.filePath,
        baseHash: parsed.baseHash,
        edits: parsed.edits,
      });
      if (patch.afterHash !== parsed.afterHash) {
        throw new ServiceError("afterHash mismatch: patch was altered in transit", 400);
      }
      const result = await deps.source.write(patch);
      await deps.patches.recordPatch(patch, parsed.author, null);
      return { afterHash: result.afterHash, filePath: patch.filePath };
    },
    async history() {
      return deps.patches.listPatches();
    },
  };
}

export type SourceService = ReturnType<typeof createSourceService>;
