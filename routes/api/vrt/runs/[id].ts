import { defineHandler } from "void";
import { services } from "../../../../src/factory";
import { errorJson } from "../../../../src/service/errors";

export const GET = defineHandler(async (c) => {
  try {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "id is required" }, 400);
    return c.json(await services.vrt.runResults(id));
  } catch (error) {
    return errorJson(error);
  }
});
