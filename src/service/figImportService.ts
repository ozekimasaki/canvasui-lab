import { parse as babelParse } from "@babel/parser";
import { z } from "zod";
import { generateComponentCode, pascal } from "../domain/figCodegen";
import { mapFig, type FigIR } from "../domain/figmap";
import type { StoragePort } from "../ports";
import type { SourceRepo } from "../repository/sourceRepo";
import { ServiceError } from "./errors";
import type { createTokenService } from "./tokenService";

const irSchema = z
  .object({
    nodes: z.array(z.object({ id: z.string(), type: z.string(), name: z.string() }).passthrough()),
    children: z.record(z.string(), z.array(z.string())),
    roots: z.array(z.string()),
    tokens: z
      .array(
        z.object({
          name: z.string(),
          type: z.enum(["color", "number", "string", "boolean"]),
          collection: z.string(),
          values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
        }),
      )
      .optional(),
    assets: z.array(z.object({ key: z.string(), dataUrl: z.string() })).optional(),
  })
  .passthrough();

export function createFigImportService(deps: {
  source: SourceRepo;
  tokens: ReturnType<typeof createTokenService>;
  storage: StoragePort;
}) {
  return {
    async importFig(input: unknown) {
      const parsed = irSchema.parse(input);
      const result = mapFig(parsed as unknown as FigIR);
      const components: { name: string; filePath: string; written: boolean }[] = [];
      for (const def of result.components) {
        const name = pascal(def.name);
        const filePath = `src/components/imported/${name}.tsx`;
        const code = generateComponentCode(def, result.nodes);
        try {
          babelParse(code, { sourceType: "module", plugins: ["typescript", "jsx"] });
        } catch (error) {
          result.report.push({
            nodeId: def.id,
            type: "COMPONENT",
            reason: `generated code does not parse: ${error instanceof Error ? error.message : ""}`,
            approximation: "skipped",
          });
          continue;
        }
        let written = false;
        if (deps.source.create) {
          try {
            await deps.source.create(filePath, code);
            written = true;
          } catch (error) {
            result.report.push({
              nodeId: def.id,
              type: "COMPONENT",
              reason: error instanceof Error ? error.message : "create failed",
              approximation: "document-only",
            });
          }
        } else {
          result.report.push({
            nodeId: def.id,
            type: "COMPONENT",
            reason: "write-back mode cannot create files",
            approximation: "document-only",
          });
        }
        components.push({ name, filePath, written });
      }
      if (parsed.tokens?.length) {
        await deps.tokens.importCanonical({ source: "figma", tokens: parsed.tokens });
      }
      for (const asset of parsed.assets ?? []) {
        const match = /^data:([^;]+);base64,(.*)$/.exec(asset.dataUrl);
        if (!match) continue;
        const bytes = Uint8Array.from(atob(match[2]), (ch) => ch.charCodeAt(0));
        await deps.storage.put(`fig/${asset.key}`, bytes, { contentType: match[1] });
      }
      if (result.roots.length === 0 && Object.keys(result.nodes).length === 0) {
        throw new ServiceError("no mappable nodes found in .fig file");
      }
      return { nodes: result.nodes, roots: result.roots, report: result.report, components };
    },
  };
}

export type FigImportService = ReturnType<typeof createFigImportService>;
