import { defineHandler } from "void";
import { services } from "../../src/factory";
import { errorJson } from "../../src/service/errors";

export const POST = defineHandler(async (c) => {
  try {
    return c.json(await services.matrix.register(await c.req.json()));
  } catch (error) {
    return errorJson(error);
  }
});

export const GET = defineHandler(async () => {
  try {
    return new Response(JSON.stringify(await services.matrix.list()), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    return errorJson(error);
  }
});
