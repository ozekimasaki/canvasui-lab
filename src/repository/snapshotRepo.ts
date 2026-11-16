import { and, db, desc, eq } from "void/db";
import { storage } from "void/storage";
import { snapshots } from "@schema";
import type { FactoryGate, ValidatedSnapshot } from "../domain/brands";
import { baselinePrefix, r2KeyFor } from "../domain/snapshot";

export function createSnapshotRepo(gate: FactoryGate) {
  if (!gate) throw new Error("FactoryGate required");
  return {
    async save(s: ValidatedSnapshot) {
      const r2Key = r2KeyFor(s.kind, s.source, s.componentId, s.cellKey, s.contentHash);
      await storage.put(r2Key, s.png, { httpMetadata: { contentType: "image/png" } });
      const [row] = await insertSnapshot(s, r2Key);
      return row;
    },
    async latestBaseline(componentId: string, cellKey: string) {
      const rows = await db
        .select()
        .from(snapshots)
        .where(
          and(
            eq(snapshots.componentId, componentId),
            eq(snapshots.cellKey, cellKey),
            eq(snapshots.kind, "baseline"),
          ),
        )
        .orderBy(desc(snapshots.createdAt))
        .limit(1);
      return rows[0] ?? null;
    },
    async latestDesign(componentId: string, cellKey: string) {
      const rows = await db
        .select()
        .from(snapshots)
        .where(
          and(
            eq(snapshots.componentId, componentId),
            eq(snapshots.cellKey, cellKey),
            eq(snapshots.kind, "design"),
          ),
        )
        .orderBy(desc(snapshots.createdAt))
        .limit(1);
      return rows[0] ?? null;
    },
    async listByCell(componentId: string, cellKey: string) {
      return db
        .select()
        .from(snapshots)
        .where(and(eq(snapshots.componentId, componentId), eq(snapshots.cellKey, cellKey)))
        .orderBy(desc(snapshots.createdAt));
    },
    async listBaselines() {
      return db.select().from(snapshots).where(eq(snapshots.kind, "baseline"));
    },
    async png(r2Key: string): Promise<Uint8Array | null> {
      const object = await storage.get(r2Key);
      if (!object) return null;
      return new Uint8Array(await object.arrayBuffer());
    },
    async deleteBaselinePrefix(componentId: string, cellKey: string) {
      const listed = await storage.list({ prefix: baselinePrefix(componentId, cellKey) });
      for (const obj of listed.objects) {
        await storage.delete(obj.key);
      }
    },
  };
}

function insertSnapshot(s: ValidatedSnapshot, r2Key: string) {
  return db
    .insert(snapshots)
    .values({
      id: crypto.randomUUID(),
      componentId: s.componentId,
      cellKey: s.cellKey,
      kind: s.kind,
      source: s.source,
      r2Key,
      width: s.width,
      height: s.height,
      scale: s.scale,
      contentHash: s.contentHash,
    })
    .returning();
}

export type SnapshotRepo = ReturnType<typeof createSnapshotRepo>;
