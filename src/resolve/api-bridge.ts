import type { Context } from "hono";
import type { Services } from "../factory";
import { errorJson } from "../service/errors";
export const POST = (services: Services) => async (c: Context) => {
  try {
    const body = (await c.req.json()) as {
      kind?: string;
      topic?: string;
      commandId?: string;
      payload?: unknown;
    };
    if (body.kind === "result" && typeof body.commandId === "string") {
      await services.bridge.putResult(body.commandId, body.payload);
      return c.json({ ok: true });
    }
    await services.bridge.putState(body.topic ?? "canvas", body.payload);
    return c.json({ ok: true });
  } catch (error) {
    return errorJson(error);
  }
};
