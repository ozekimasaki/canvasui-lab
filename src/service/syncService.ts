import { and, eq } from "drizzle-orm";
import { canvasLayouts, presence } from "@schema";
import { z } from "zod";
import type { Document } from "../domain/document";
import type { DbPort, LivePort } from "../ports";

const layoutSchema = z.object({ docId: z.string(), doc: z.unknown(), user: z.string() });
const presenceSchema = z.object({
  docId: z.string(),
  userId: z.string(),
  name: z.string(),
  color: z.string(),
  x: z.number(),
  y: z.number(),
});

export function createSyncService(deps: { db: DbPort; live: LivePort }) {
  return {
    async pull(docId: string) {
      const rows = await deps.db
        .select()
        .from(canvasLayouts)
        .where(eq(canvasLayouts.docId, docId))
        .limit(1);
      const peers = await deps.db.select().from(presence).where(eq(presence.docId, docId));
      const cutoff = Date.now() - 15000;
      return {
        layout: rows[0]
          ? {
              doc: JSON.parse(rows[0].json) as Document,
              version: rows[0].version,
              updatedBy: rows[0].updatedBy,
            }
          : null,
        presence: peers.filter((peer) => Date.parse(peer.ts) > cutoff),
      };
    },
    async pushLayout(input: unknown) {
      const parsed = layoutSchema.parse(input);
      const json = JSON.stringify(parsed.doc);
      const existing = await deps.db
        .select()
        .from(canvasLayouts)
        .where(eq(canvasLayouts.docId, parsed.docId))
        .limit(1);
      const version = (existing[0]?.version ?? 0) + 1;
      if (existing[0]) {
        await deps.db
          .update(canvasLayouts)
          .set({ json, version, updatedBy: parsed.user, updatedAt: new Date().toISOString() })
          .where(eq(canvasLayouts.docId, parsed.docId));
      } else {
        await deps.db
          .insert(canvasLayouts)
          .values({ docId: parsed.docId, json, version, updatedBy: parsed.user });
      }
      await deps.live.publish(
        `doc:${parsed.docId}`,
        { doc: parsed.doc, version, user: parsed.user },
        "layout",
      );
      return { version };
    },
    async pushPresence(input: unknown) {
      const parsed = presenceSchema.parse(input);
      const existing = await deps.db
        .select()
        .from(presence)
        .where(and(eq(presence.docId, parsed.docId), eq(presence.userId, parsed.userId)))
        .limit(1);
      const ts = new Date().toISOString();
      if (existing[0]) {
        await deps.db
          .update(presence)
          .set({
            name: parsed.name,
            color: parsed.color,
            cursorX: Math.round(parsed.x),
            cursorY: Math.round(parsed.y),
            ts,
          })
          .where(and(eq(presence.docId, parsed.docId), eq(presence.userId, parsed.userId)));
      } else {
        await deps.db.insert(presence).values({
          docId: parsed.docId,
          userId: parsed.userId,
          name: parsed.name,
          color: parsed.color,
          cursorX: Math.round(parsed.x),
          cursorY: Math.round(parsed.y),
          ts,
        });
      }
      await deps.live.publish(`presence:${parsed.docId}`, parsed, "presence");
      return { ok: true };
    },
  };
}

export type SyncService = ReturnType<typeof createSyncService>;
