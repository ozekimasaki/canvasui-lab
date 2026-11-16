import type { Context } from "hono";
import type { Services } from "../factory";
import { eventStream } from "void/sse";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
import { errorJson } from "../service/errors";
import { dispatchBatch } from "../../routes/api/mcp/_dispatch";
export const POST = (services: Services) => async (c: Context) => {
  try {
    const sessionId = c.req.header("mcp-session-id") ?? null;
    const body: unknown = await c.req.json();
    const result = await dispatchBatch(services, sessionId, body);
    if (Array.isArray(result)) return c.json(result);
    const headers: Record<string, string> = {};
    if (result.newSession) headers["mcp-session-id"] = result.newSession;
    if (result.response) return c.json(result.response, 200, headers);
    return c.body(null, 202, headers);
  } catch (error) {
    return errorJson(error);
  }
};
export const GET = (services: Services) => async (c: Context) => {
  const sessionId = c.req.header("mcp-session-id");
  if (!sessionId) return c.json({ error: "mcp-session-id header required" }, 400);
  return eventStream(
    async (stream) => {
      for (;;) {
        if (c.req.raw.signal.aborted) break;
        const rows = await services.mcpRepo.drainOutbox(sessionId);
        for (const row of rows) {
          await stream.send({ event: "message", data: row.payload });
        }
        await sleep(250);
      }
    },
    { signal: c.req.raw.signal },
  );
};
export const DELETE = (services: Services) => async (c: Context) => {
  try {
    const sessionId = c.req.header("mcp-session-id");
    if (sessionId) await services.mcpRepo.deleteSession(sessionId);
    return c.json({ ok: true });
  } catch (error) {
    return errorJson(error);
  }
};
