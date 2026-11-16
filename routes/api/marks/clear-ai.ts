import { defineHandler } from "void";
import { services } from "../../../src/factory";
import { errorJson } from "../../../src/service/errors";

export const POST = defineHandler(async () => {
  try {
    return new Response(JSON.stringify(await services.marks.clearAi()), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    return errorJson(error);
  }
});
