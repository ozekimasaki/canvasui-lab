import { z } from "zod";
import type { ValidatedComponentSpec } from "../domain/brands";
import type { ComponentRepo } from "../repository/componentRepo";

const specSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  filePath: z.string().min(1).max(500),
  axes: z.record(z.string(), z.array(z.string().min(1)).min(1)),
  defaultArgs: z.record(z.string(), z.unknown()).default({}),
});

const registerSchema = z.object({ specs: z.array(specSchema).min(1).max(500) });

export function createMatrixService(deps: { components: ComponentRepo }) {
  return {
    async register(input: unknown) {
      const { specs } = registerSchema.parse(input);
      const validated = specs.map((s) => s as unknown as ValidatedComponentSpec);
      const count = await deps.components.upsertMany(validated);
      return { registered: count };
    },
    async list() {
      const rows = await deps.components.listAll();
      return rows.map((row) => {
        const meta = JSON.parse(row.metaJson) as {
          axes: Record<string, string[]>;
          defaultArgs: Record<string, unknown>;
        };
        return { id: row.id, title: row.title, filePath: row.filePath, ...meta };
      });
    },
  };
}

export type MatrixService = ReturnType<typeof createMatrixService>;
