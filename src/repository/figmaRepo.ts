import { eq } from "drizzle-orm";
import type { DbPort } from "../ports";
import { figmaLinks } from "@schema";
import type { FactoryGate, ValidatedFigmaLink } from "../domain/brands";

export function createFigmaRepo(gate: FactoryGate, db: DbPort) {
  if (!gate) throw new Error("FactoryGate required");
  return {
    async saveLink(link: ValidatedFigmaLink) {
      const existing = await db
        .select()
        .from(figmaLinks)
        .where(eq(figmaLinks.nodeId, link.nodeId))
        .limit(1);
      if (existing[0]) {
        await db
          .update(figmaLinks)
          .set({
            componentId: link.componentId,
            fileKey: link.fileKey,
            r2Key: link.r2Key,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(figmaLinks.id, existing[0].id));
        return existing[0].id;
      }
      const id = crypto.randomUUID();
      await db.insert(figmaLinks).values({
        id,
        componentId: link.componentId,
        fileKey: link.fileKey,
        nodeId: link.nodeId,
        r2Key: link.r2Key,
      });
      return id;
    },
    async listLinks() {
      return db.select().from(figmaLinks);
    },
  };
}

export type FigmaRepo = ReturnType<typeof createFigmaRepo>;
