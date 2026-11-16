import { defineHandler } from "void";
import { services } from "../../src/factory";
import { errorJson } from "../../src/service/errors";

export const GET = defineHandler(async (c) => {
  try {
    return c.json(await services.marks.list(c.req.query("cellKey")));
  } catch (error) {
    return errorJson(error);
  }
});

export const POST = defineHandler(async (c) => {
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
});
