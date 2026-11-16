import { defineHandler } from "void";
import { services } from "../../src/factory";
import { errorJson } from "../../src/service/errors";

export const GET = defineHandler(async () => {
  try {
    return new Response(JSON.stringify(await services.tokens.list()), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    return errorJson(error);
  }
});
