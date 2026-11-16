import { defineHandler } from "void";
import { env } from "void/env";

export const ssr = false;

export const loader = defineHandler(() => {
  return { appName: "CanvasUI Lab", bridgeToken: env.BRIDGE_TOKEN ?? "" };
});
