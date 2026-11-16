import type { Context } from "hono";
import type { Services } from "../factory";
import { errorJson } from "../service/errors";
export const POST = (services: Services) => async (_c: Context) => {
  try {
    return new Response(JSON.stringify(await services.marks.clearAi()), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    return errorJson(error);
  }
};
