import { eq } from "drizzle-orm";
import type { DbPort } from "../ports";
import { components } from "@schema";
import type { FactoryGate, ValidatedComponentSpec } from "../domain/brands";

export function createComponentRepo(gate: FactoryGate, db: DbPort) {
  if (!gate) throw new Error("FactoryGate required");
  return {
    async upsertMany(specs: readonly ValidatedComponentSpec[]) {
      for (const spec of specs) {
        const metaJson = JSON.stringify({ axes: spec.axes, defaultArgs: spec.defaultArgs });
        const existing = await db
          .select()
          .from(components)
          .where(eq(components.id, spec.id))
          .limit(1);
        if (existing[0]) {
          await db
            .update(components)
            .set({
              title: spec.title,
              filePath: spec.filePath,
              metaJson,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(components.id, spec.id));
        } else {
          await db.insert(components).values({
            id: spec.id,
            title: spec.title,
            filePath: spec.filePath,
            metaJson,
          });
        }
      }
      return specs.length;
    },
    async listAll() {
      return db.select().from(components);
    },
  };
}

export type ComponentRepo = ReturnType<typeof createComponentRepo>;
