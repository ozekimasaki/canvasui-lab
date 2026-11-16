import { z } from "zod";
import type { ValidatedAuditMark } from "../domain/brands";
import type { MarkRepo } from "../repository/markRepo";

const markSchema = z.object({
  cellKey: z.string().min(1).max(300),
  targetElementId: z.string().max(100).nullable().default(null),
  kind: z.enum(["pin", "note"]),
  text: z.string().min(1).max(2000),
  severity: z.enum(["info", "warning", "error"]).default("info"),
  author: z.enum(["ai", "human"]),
  runId: z.string().max(100).nullable().default(null),
});

const createSchema = z.object({ marks: z.array(markSchema).min(1).max(200) });

export function createMarkService(deps: { marks: MarkRepo }) {
  return {
    async create(input: unknown) {
      const { marks } = createSchema.parse(input);
      const validated = marks.map((m) => m as ValidatedAuditMark);
      const ids = await deps.marks.saveMany(validated);
      return { created: ids.length, ids };
    },
    async list(cellKey?: string) {
      return cellKey ? deps.marks.listByCell(cellKey) : deps.marks.listAll();
    },
    async remove(id: string) {
      await deps.marks.remove(id);
      return { removed: id };
    },
    async clearAi() {
      await deps.marks.clearAuthor("ai");
      return { cleared: "ai" };
    },
  };
}

export type MarkService = ReturnType<typeof createMarkService>;
