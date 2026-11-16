import { defineHandler } from "void";
import { services } from "../../../src/factory";
import { errorJson } from "../../../src/service/errors";

export const POST = defineHandler(async (c) => {
  try {
    return c.json(await services.vrt.submitRun(await c.req.json()));
  } catch (error) {
    return errorJson(error);
  }
});

export const GET = defineHandler(async (c) => {
  try {
    return c.json(await services.vrt.listRuns());
  } catch (error) {
    return errorJson(error);
  }
});
