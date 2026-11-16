import { defineHandler } from "void";
import { services } from "../../../src/factory";
import { errorJson } from "../../../src/service/errors";
import { dispatchBatch } from "./_dispatch";

export const POST = defineHandler(async (c) => {
  try {
    const sessionId = c.req.query("sessionId") ?? null;
    if (!sessionId) return c.json({ error: "sessionId query required" }, 400);
    const body: unknown = await c.req.json();
    const result = await dispatchBatch(sessionId, body);
    const responses = Array.isArray(result) ? result : result.response ? [result.response] : [];
    for (const response of responses) {
      await services.mcpRepo.pushOutbox(sessionId, JSON.stringify(response));
    }
    return c.body(null, 202);
  } catch (error) {
    return errorJson(error);
  }
});
