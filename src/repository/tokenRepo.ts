import { eq } from "drizzle-orm";
import type { DbPort } from "../ports";
import { designTokens } from "@schema";
import type { FactoryGate, ValidatedDesignToken } from "../domain/brands";

export function createTokenRepo(gate: FactoryGate, db: DbPort) {
  if (!gate) throw new Error("FactoryGate required");
  return {
    async upsertMany(tokens: readonly ValidatedDesignToken[]) {
      for (const token of tokens) {
        const existing = await db
          .select()
          .from(designTokens)
          .where(eq(designTokens.name, token.name))
          .limit(1);
        const valuesJson = JSON.stringify(token.values);
        if (existing[0]) {
          await db
            .update(designTokens)
            .set({
              source: token.source,
              type: token.type,
              collection: token.collection,
              valuesJson,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(designTokens.id, existing[0].id));
        } else {
          await db.insert(designTokens).values({
            id: crypto.randomUUID(),
            source: token.source,
            name: token.name,
            type: token.type,
            collection: token.collection,
            valuesJson,
          });
        }
      }
      return tokens.length;
    },
    async listAll() {
      return db.select().from(designTokens);
    },
  };
}

export type TokenRepo = ReturnType<typeof createTokenRepo>;
