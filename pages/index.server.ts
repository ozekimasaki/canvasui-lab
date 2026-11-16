import { defineHandler } from "void";

export const ssr = false;

export const loader = defineHandler(() => {
  return { appName: "CanvasUI Lab" };
});
