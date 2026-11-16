import { z } from "zod";
import type { ValidatedVrtResult, ValidatedVrtRun } from "../domain/brands";
import type { VrtRepo } from "../repository/vrtRepo";

const boundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
});

const resultSchema = z.object({
  cellKey: z.string().min(1).max(300),
  changed: z.boolean(),
  diffRatio: z.number().min(0).max(1),
  bounds: boundsSchema.nullable(),
});

const runSchema = z.object({ results: z.array(resultSchema).min(1).max(20000) });

export function createVrtService(deps: { vrt: VrtRepo }) {
  return {
    async submitRun(input: unknown) {
      const { results } = runSchema.parse(input);
      const validatedResults = results.map((r) => r as ValidatedVrtResult);
      const run = {
        id: crypto.randomUUID(),
        totalCells: results.length,
        changedCells: results.filter((r) => r.changed).length,
        results: validatedResults,
      } as unknown as ValidatedVrtRun;
      const id = await deps.vrt.saveRun(run);
      return { runId: id, totalCells: run.totalCells, changedCells: run.changedCells };
    },
    async listRuns() {
      return deps.vrt.listRuns();
    },
    async runResults(runId: string) {
      const rows = await deps.vrt.runResults(runId);
      return rows.map((row) => ({
        cellKey: row.cellKey,
        changed: row.changed === 1,
        diffRatio: row.diffRatio,
        bounds: row.boundsJson
          ? (JSON.parse(row.boundsJson) as z.infer<typeof boundsSchema>)
          : null,
      }));
    },
  };
}

export type VrtService = ReturnType<typeof createVrtService>;
