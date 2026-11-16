import { defineHandler } from "void";
import { services } from "../../../src/factory";
import { errorJson } from "../../../src/service/errors";

export const POST = defineHandler(async (c) => {
  try {
    const body = (await c.req.json()) as { format?: string; payload?: unknown };
    if (body.format === "dtcg") {
      return c.json(await services.tokens.importDtcg(body.payload));
    }
    return c.json(await services.tokens.importCanonical(body.payload));
  } catch (error) {
    return errorJson(error);
  }
});
