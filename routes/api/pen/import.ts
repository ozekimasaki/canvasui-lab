import { defineHandler } from "void";
import { services } from "../../../src/factory";
import { errorJson } from "../../../src/service/errors";

export const POST = defineHandler(async (c) => {
  try {
    const body = (await c.req.json()) as { raw?: string };
    if (typeof body.raw !== "string") {
      return c.json({ error: "body.raw (.pen file content) is required" }, 400);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(body.raw);
    } catch {
      parsed = JSON.parse(body.raw.replace(/^\s*\/\/.*$/gm, ""));
    }
    return c.json(await services.pen.importTokens(parsed));
  } catch (error) {
    return errorJson(error);
  }
});
