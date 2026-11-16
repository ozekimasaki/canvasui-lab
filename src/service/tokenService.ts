import { z } from "zod";
import type { ValidatedDesignToken } from "../domain/brands";
import type { TokenRepo } from "../repository/tokenRepo";
import { ServiceError } from "./errors";

const tokenSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["color", "number", "string", "boolean"]),
  collection: z.string().max(200).default(""),
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});

const canonicalSchema = z.object({
  source: z.enum(["figma", "pen", "dtcg"]),
  tokens: z.array(tokenSchema).min(1).max(5000),
});

export type CanonicalTokenImport = z.infer<typeof canonicalSchema>;

export function createTokenService(deps: { tokens: TokenRepo }) {
  return {
    async importCanonical(input: unknown) {
      const parsed = canonicalSchema.parse(input);
      const validated = parsed.tokens.map(
        (t) => ({ ...t, source: parsed.source }) as ValidatedDesignToken,
      );
      const count = await deps.tokens.upsertMany(validated);
      return { imported: count, source: parsed.source };
    },
    async importDtcg(input: unknown) {
      const parsed = z.record(z.string(), z.unknown()).parse(input);
      const tokens: z.infer<typeof tokenSchema>[] = [];
      walkDtcg(parsed, "", tokens);
      if (tokens.length === 0) throw new ServiceError("No DTCG tokens found");
      return this.importCanonical({ source: "dtcg", tokens });
    },
    async list() {
      const rows = await deps.tokens.listAll();
      return rows.map((row) => ({
        id: row.id,
        source: row.source,
        name: row.name,
        type: row.type,
        collection: row.collection,
        values: JSON.parse(row.valuesJson) as Record<string, string | number | boolean>,
      }));
    },
  };
}

function walkDtcg(
  node: Record<string, unknown>,
  prefix: string,
  out: z.infer<typeof tokenSchema>[],
): void {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    const name = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && "$value" in value) {
      const entry = value as { $value: unknown; $type?: string };
      const converted = convertDtcgValue(entry.$value, entry.$type);
      if (converted)
        out.push({
          name,
          type: converted.type,
          collection: prefix,
          values: { "": converted.value },
        });
    } else if (value && typeof value === "object") {
      walkDtcg(value as Record<string, unknown>, name, out);
    }
  }
}

function convertDtcgValue(
  value: unknown,
  type?: string,
): { type: "color" | "number" | "string" | "boolean"; value: string | number | boolean } | null {
  if (typeof value === "string" && (type === "color" || /^#([0-9a-f]{3,8})$/i.test(value))) {
    return { type: "color", value };
  }
  if (typeof value === "number") return { type: "number", value };
  if (typeof value === "boolean") return { type: "boolean", value };
  if (typeof value === "string") {
    const dimension = /^(-?[\d.]+)(px|rem)$/.exec(value);
    if (dimension) return { type: "number", value: Number(dimension[1]) };
    return { type: "string", value };
  }
  if (value && typeof value === "object" && "colorSpace" in value && "components" in value) {
    const v = value as { colorSpace: string; components: number[]; alpha?: number };
    if (v.colorSpace === "srgb" && v.components.length >= 3) {
      const [r, g, b] = v.components.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255));
      const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
      return { type: "color", value: hex };
    }
  }
  return null;
}

export type TokenService = ReturnType<typeof createTokenService>;
