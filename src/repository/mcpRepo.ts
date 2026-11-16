import { db, desc, eq, lt } from "void/db";
import { bridgeResults, bridgeState, mcpOutbox, mcpSessions, sourcePatches } from "@schema";
import type { FactoryGate, ValidatedASTPatch } from "../domain/brands";

export function createMcpRepo(gate: FactoryGate) {
  if (!gate) throw new Error("FactoryGate required");
  return {
    async createSession(id: string, protocolVersion: string, clientInfo: string, ttlMs: number) {
      const expiresAt = new Date(Date.now() + ttlMs).toISOString();
      await db.insert(mcpSessions).values({ id, protocolVersion, clientInfo, expiresAt });
      return { id, expiresAt };
    },
    async session(id: string) {
      const rows = await db.select().from(mcpSessions).where(eq(mcpSessions.id, id)).limit(1);
      return rows[0] ?? null;
    },
    async markInitialized(id: string) {
      await db.update(mcpSessions).set({ initialized: 1 }).where(eq(mcpSessions.id, id));
    },
    async initSession(id: string, protocolVersion: string, clientInfo: string) {
      await db
        .update(mcpSessions)
        .set({ protocolVersion, clientInfo })
        .where(eq(mcpSessions.id, id));
    },
    async deleteSession(id: string) {
      await db.delete(mcpSessions).where(eq(mcpSessions.id, id));
      await db.delete(mcpOutbox).where(eq(mcpOutbox.sessionId, id));
    },
    async pushOutbox(sessionId: string, payload: string) {
      const id = crypto.randomUUID();
      await db.insert(mcpOutbox).values({ id, sessionId, payload });
      return id;
    },
    async drainOutbox(sessionId: string, limit = 32) {
      const rows = await db
        .select()
        .from(mcpOutbox)
        .where(eq(mcpOutbox.sessionId, sessionId))
        .orderBy(mcpOutbox.createdAt)
        .limit(limit);
      for (const row of rows) await db.delete(mcpOutbox).where(eq(mcpOutbox.id, row.id));
      return rows;
    },
    async putState(topic: string, payload: string) {
      const existing = await db
        .select()
        .from(bridgeState)
        .where(eq(bridgeState.topic, topic))
        .limit(1);
      if (existing[0]) {
        await db
          .update(bridgeState)
          .set({ payload, updatedAt: new Date().toISOString() })
          .where(eq(bridgeState.id, existing[0].id));
        return existing[0].id;
      }
      const id = crypto.randomUUID();
      await db.insert(bridgeState).values({ id, topic, payload });
      return id;
    },
    async getState(topic: string) {
      const rows = await db.select().from(bridgeState).where(eq(bridgeState.topic, topic)).limit(1);
      return rows[0] ?? null;
    },
    async putResult(commandId: string, payload: string) {
      await db.insert(bridgeResults).values({ id: crypto.randomUUID(), commandId, payload });
    },
    async takeResult(commandId: string) {
      const rows = await db
        .select()
        .from(bridgeResults)
        .where(eq(bridgeResults.commandId, commandId))
        .limit(1);
      if (rows[0]) await db.delete(bridgeResults).where(eq(bridgeResults.id, rows[0].id));
      return rows[0] ?? null;
    },
    async recordPatch(
      patch: ValidatedASTPatch,
      author: "gui" | "ai" | "mcp",
      prUrl: string | null,
    ) {
      const id = crypto.randomUUID();
      await db.insert(sourcePatches).values({
        id,
        filePath: patch.filePath,
        beforeHash: patch.baseHash,
        afterHash: patch.afterHash,
        editsJson: JSON.stringify(patch.edits),
        author,
        prUrl,
      });
      return id;
    },
    async listPatches() {
      return db.select().from(sourcePatches).orderBy(desc(sourcePatches.createdAt)).limit(100);
    },
    async cleanup(beforeIso: string) {
      await db.delete(mcpOutbox).where(lt(mcpOutbox.createdAt, beforeIso));
      await db.delete(mcpSessions).where(lt(mcpSessions.expiresAt, beforeIso));
      await db.delete(bridgeResults).where(lt(bridgeResults.createdAt, beforeIso));
    },
  };
}

export type McpRepo = ReturnType<typeof createMcpRepo>;
