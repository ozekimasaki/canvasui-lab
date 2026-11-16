import { defineHandler } from "void";
import { services } from "../../src/factory";
import { errorJson } from "../../src/service/errors";

export const POST = defineHandler(async (c) => {
  try {
    return c.json(await services.audit.audit(await c.req.json()));
  } catch (error) {
    return errorJson(error);
  }
});
