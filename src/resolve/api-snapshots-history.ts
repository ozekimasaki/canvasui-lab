import type { Context } from "hono";
import type { Services } from "../factory";
import { errorJson } from "../service/errors";
export const GET = (services: Services) => async (c: Context) => {
  try {
    const componentId = c.req.query("componentId") ?? "";
    const cellKey = c.req.query("cellKey") ?? "";
    return c.json(await services.snapshots.history(componentId, cellKey));
  } catch (error) {
    return errorJson(error);
  }
};
