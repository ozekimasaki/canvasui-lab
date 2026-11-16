import { defineHandler } from "void";
import { services } from "../../../src/factory";
import { errorJson } from "../../../src/service/errors";

export const GET = defineHandler(async (c) => {
  try {
    const componentId = c.req.query("componentId") ?? "";
    const cellKey = c.req.query("cellKey") ?? "";
    return c.json(await services.snapshots.history(componentId, cellKey));
  } catch (error) {
    return errorJson(error);
  }
});
