import type { Context } from "hono";
import type { Services } from "../factory";
import { errorJson } from "../service/errors";
export const POST = (services: Services) => async (c: Context) => {
  try {
    return c.json(await services.matrix.register(await c.req.json()));
  } catch (error) {
    return errorJson(error);
  }
};
export const GET = (services: Services) => async (_c: Context) => {
  try {
    return new Response(JSON.stringify(await services.matrix.list()), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    return errorJson(error);
  }
};
