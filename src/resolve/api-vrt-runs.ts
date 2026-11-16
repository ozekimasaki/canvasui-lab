import type { Context } from "hono";
import type { Services } from "../factory";
import { errorJson } from "../service/errors";
export const POST = (services: Services) => async (c: Context) => {
  try {
    return c.json(await services.vrt.submitRun(await c.req.json()));
  } catch (error) {
    return errorJson(error);
  }
};
export const GET = (services: Services) => async (c: Context) => {
  try {
    return c.json(await services.vrt.listRuns());
  } catch (error) {
    return errorJson(error);
  }
};
