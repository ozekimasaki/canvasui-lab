import { defineEnv, string } from "void/env";

export default defineEnv({
  FIGMA_TOKEN: string().optional(),
});
