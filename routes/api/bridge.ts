import { defineHandler } from "void";
import { services } from "../../src/factory";
import { errorJson } from "../../src/service/errors";

export const POST = defineHandler(async (c) => {
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
});
