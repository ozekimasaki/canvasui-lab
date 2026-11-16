import { desc, eq } from "drizzle-orm";
import type { DbPort } from "../ports";
import { vrtResults, vrtRuns } from "@schema";
import type { FactoryGate, ValidatedVrtRun } from "../domain/brands";

export function createVrtRepo(gate: FactoryGate, db: DbPort) {
  if (!gate) throw new Error("FactoryGate required");
  return {
    async saveRun(run: ValidatedVrtRun) {
      await db.insert(vrtRuns).values({
        id: run.id,
        totalCells: run.totalCells,
        changedCells: run.changedCells,
      });
      for (const result of run.results) {
        await db.insert(vrtResults).values({
          id: crypto.randomUUID(),
          runId: run.id,
          cellKey: result.cellKey,
          changed: result.changed ? 1 : 0,
          diffRatio: result.diffRatio,
          boundsJson: result.bounds ? JSON.stringify(result.bounds) : null,
        });
      }
      return run.id;
    },
    async listRuns() {
      return db.select().from(vrtRuns).orderBy(desc(vrtRuns.createdAt)).limit(50);
    },
    async runResults(runId: string) {
      return db.select().from(vrtResults).where(eq(vrtResults.runId, runId));
    },
  };
}

export type VrtRepo = ReturnType<typeof createVrtRepo>;
