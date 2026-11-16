import type { Context } from "hono";
import type { Services } from "../factory";
import { errorJson } from "../service/errors";
export const POST = (services: Services) => async (c: Context) => {
  try {
    return c.json(await services.audit.audit(await c.req.json()));
  } catch (error) {
    return errorJson(error);
  }
};
