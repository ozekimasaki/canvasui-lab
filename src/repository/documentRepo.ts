import { eq } from "drizzle-orm";
import { documents } from "@schema";
import type { Document } from "../domain/document";
import type { FactoryGate } from "../domain/brands";
import type { DbPort } from "../ports";

export function createDocumentRepo(gate: FactoryGate, db: DbPort) {
  if (!gate) throw new Error("FactoryGate required");
  return {
    async get(id: string): Promise<Document | null> {
      const rows = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
      return rows[0] ? (JSON.parse(rows[0].json) as Document) : null;
    },
    async put(doc: Document): Promise<void> {
      const json = JSON.stringify(doc);
      const existing = await db.select().from(documents).where(eq(documents.id, doc.id)).limit(1);
      if (existing[0]) {
        await db
          .update(documents)
          .set({
            name: doc.name,
            json,
            version: existing[0].version + 1,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(documents.id, doc.id));
      } else {
        await db.insert(documents).values({ id: doc.id, name: doc.name, json, version: 1 });
      }
    },
    async list(): Promise<{ id: string; name: string; updatedAt: string }[]> {
      const rows = await db.select().from(documents);
      return rows.map((row) => ({ id: row.id, name: row.name, updatedAt: row.updatedAt }));
    },
  };
}

export type DocumentRepo = ReturnType<typeof createDocumentRepo>;
