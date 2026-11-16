import { defineEnv, oneOf, string } from "void/env";

export default defineEnv({
  FIGMA_TOKEN: string().optional(),
  WRITEBACK_MODE: oneOf(["local", "github", "off"]).default("off"),
  CANVASUI_WRITEBACK_TOKEN: string().optional(),
  GITHUB_TOKEN: string().optional(),
  GITHUB_REPO: string().optional(),
  MCP_AUTH_TOKEN: string().optional(),
  BRIDGE_TOKEN: string().optional(),
});
