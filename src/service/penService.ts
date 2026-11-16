import { z } from "zod";
import { themeCombinations, themeKey } from "../domain/token";
import { ServiceError } from "./errors";
import type { TokenService } from "./tokenService";

const themedValueSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
  theme: z.record(z.string(), z.string()).optional(),
});

const variableSchema = z.object({
  type: z.enum(["color", "number", "string", "boolean"]),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(themedValueSchema)]),
});

const penDocumentSchema = z.object({
  version: z.string(),
  themes: z.record(z.string(), z.array(z.string())).optional(),
  variables: z.record(z.string(), variableSchema).optional(),
  children: z.array(z.unknown()).optional(),
});

export interface PenComponentEntry {
  id: string;
  name: string;
  type: string;
}

export function createPenService(deps: { tokens: TokenService }) {
  return {
    parse(input: unknown) {
      const doc = penDocumentSchema.parse(input);
      const major = doc.version.split(".")[0];
      if (major !== "2") {
        throw new ServiceError(`Unsupported .pen schema version ${doc.version} (expected 2.x)`);
      }
      const axes = doc.themes ?? {};
      const combos = themeCombinations(axes);
      const tokens: {
        name: string;
        type: "color" | "number" | "string" | "boolean";
        collection: string;
        values: Record<string, string | number | boolean>;
      }[] = [];
      for (const [name, variable] of Object.entries(doc.variables ?? {})) {
        const values: Record<string, string | number | boolean> = {};
        if (Array.isArray(variable.value)) {
          for (const combo of combos) {
            let resolved: string | number | boolean | undefined;
            for (const entry of variable.value) {
              const matches =
                !entry.theme || Object.entries(entry.theme).every(([k, v]) => combo[k] === v);
              if (matches) resolved = entry.value;
            }
            if (resolved !== undefined) values[themeKey(combo)] = resolved;
          }
        } else {
          for (const combo of combos.length > 0 ? combos : [{}]) {
            values[themeKey(combo)] = variable.value;
          }
        }
        const collection = name.includes(".") ? name.split(".")[0] : "";
        tokens.push({ name, type: variable.type, collection, values });
      }
      const components = collectReusable(doc.children ?? []);
      return { version: doc.version, themes: axes, tokens, components };
    },
    async importTokens(input: unknown) {
      const parsed = this.parse(input);
      if (parsed.tokens.length === 0)
        return { imported: 0, themes: parsed.themes, components: parsed.components };
      const result = await deps.tokens.importCanonical({ source: "pen", tokens: parsed.tokens });
      return { ...result, themes: parsed.themes, components: parsed.components };
    },
  };
}

function collectReusable(children: readonly unknown[]): PenComponentEntry[] {
  const out: PenComponentEntry[] = [];
  const walk = (nodes: readonly unknown[]) => {
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const record = node as Record<string, unknown>;
      if (record.reusable === true && typeof record.id === "string") {
        out.push({
          id: record.id,
          name: typeof record.name === "string" ? record.name : record.id,
          type: typeof record.type === "string" ? record.type : "unknown",
        });
      }
      if (Array.isArray(record.children)) walk(record.children);
    }
  };
  walk(children);
  return out;
}

export type PenService = ReturnType<typeof createPenService>;
