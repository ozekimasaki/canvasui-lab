import { db, desc, eq } from "void/db";
import { marks } from "@schema";
import type { FactoryGate, ValidatedAuditMark } from "../domain/brands";

export function createMarkRepo(gate: FactoryGate) {
  if (!gate) throw new Error("FactoryGate required");
  return {
    async saveMany(items: readonly ValidatedAuditMark[]) {
      const ids: string[] = [];
      for (const mark of items) {
        const id = crypto.randomUUID();
        await db.insert(marks).values({
          id,
          cellKey: mark.cellKey,
          targetElementId: mark.targetElementId,
          kind: mark.kind,
          text: mark.text,
          severity: mark.severity,
          author: mark.author,
          runId: mark.runId,
        });
        ids.push(id);
      }
      return ids;
    },
    async listAll() {
      return db.select().from(marks).orderBy(desc(marks.createdAt)).limit(500);
    },
    async listByCell(cellKey: string) {
      return db.select().from(marks).where(eq(marks.cellKey, cellKey));
    },
    async remove(id: string) {
      await db.delete(marks).where(eq(marks.id, id));
    },
    async clearAuthor(author: "ai" | "human") {
      await db.delete(marks).where(eq(marks.author, author));
    },
  };
}

export type MarkRepo = ReturnType<typeof createMarkRepo>;
