import type { Context } from "hono";
import type { Services } from "../factory";
import { errorJson } from "../service/errors";
import { dispatchBatch } from "../../routes/api/mcp/_dispatch";
export const POST = (services: Services) => async (c: Context) => {
  try {
    const sessionId = c.req.query("sessionId") ?? null;
    if (!sessionId) return c.json({ error: "sessionId query required" }, 400);
    const body: unknown = await c.req.json();
    const result = await dispatchBatch(services, sessionId, body);
    const responses = Array.isArray(result) ? result : result.response ? [result.response] : [];
    for (const response of responses) {
      await services.mcpRepo.pushOutbox(sessionId, JSON.stringify(response));
    }
    return c.body(null, 202);
  } catch (error) {
    return errorJson(error);
  }
};
