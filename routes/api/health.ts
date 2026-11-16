import { defineHandler } from "void";

export const GET = defineHandler(() => {
  return { ok: true, service: "canvasui-lab" };
});
