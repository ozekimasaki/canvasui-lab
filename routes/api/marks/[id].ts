import { defineHandler } from "void";
import { services } from "../../../src/factory";
import { errorJson } from "../../../src/service/errors";

export const DELETE = defineHandler(async (c) => {
  try {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "id is required" }, 400);
    return c.json(await services.marks.remove(id));
  } catch (error) {
    return errorJson(error);
  }
});
