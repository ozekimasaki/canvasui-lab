import type { Context } from "hono";
import type { Services } from "../factory";
import { errorJson } from "../service/errors";
export const POST = (services: Services) => async (c: Context) => {
  try {
    const body = (await c.req.json()) as { format?: string; payload?: unknown };
    if (body.format === "dtcg") {
      return c.json(await services.tokens.importDtcg(body.payload));
    }
    return c.json(await services.tokens.importCanonical(body.payload));
  } catch (error) {
    return errorJson(error);
  }
};
