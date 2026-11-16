import type { Context } from "hono";
import type { Services } from "../factory";
import { errorJson } from "../service/errors";
export const GET = (services: Services) => async (c: Context) => {
  try {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "id is required" }, 400);
    return c.json(await services.vrt.runResults(id));
  } catch (error) {
    return errorJson(error);
  }
};
