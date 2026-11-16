import type { Context } from "hono";
import type { Services } from "../factory";
import { errorJson } from "../service/errors";
export const GET = (services: Services) => async (c: Context) => {
  try {
    return c.json(await services.marks.list(c.req.query("cellKey")));
  } catch (error) {
    return errorJson(error);
  }
};
export const POST = (services: Services) => async (c: Context) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    return c.json(
      await services.marks.create({
        marks: [{ ...body, author: "human", runId: null }],
      }),
    );
  } catch (error) {
    return errorJson(error);
  }
};
