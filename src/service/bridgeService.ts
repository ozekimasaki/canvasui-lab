import { live } from "../live";
import type { McpRepo } from "../repository/mcpRepo";
import { ServiceError } from "./errors";

const POLL_MS = 250;

export function createBridgeService(deps: { mcp: McpRepo }) {
  return {
    async putState(topic: string, payload: unknown) {
      return deps.mcp.putState(topic, JSON.stringify(payload ?? null));
    },
    async getState(topic: string) {
      const row = await deps.mcp.getState(topic);
      return row ? (JSON.parse(row.payload) as unknown) : null;
    },
    async putResult(commandId: string, payload: unknown) {
      await deps.mcp.putResult(commandId, JSON.stringify(payload ?? null));
    },
    async command<T>(kind: string, args: unknown, timeoutMs = 60_000): Promise<T> {
      const commandId = crypto.randomUUID();
      await live.publish("canvas:bridge", { commandId, kind, args }, { type: "command" });
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const row = await deps.mcp.takeResult(commandId);
        if (row) return JSON.parse(row.payload) as T;
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
      throw new ServiceError(`bridge command "${kind}" timed out (is the canvas open?)`, 504);
    },
  };
}

export type BridgeService = ReturnType<typeof createBridgeService>;
