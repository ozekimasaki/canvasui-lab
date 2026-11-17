import type { Ctx } from "../run";
import { sleep } from "../cdp";

export interface NodeView {
  id: string;
  kind: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  flex?: unknown;
  overrides?: Record<string, unknown>;
  className?: string;
  hidden?: boolean;
}

export async function getDoc(
  ctx: Ctx,
): Promise<{ nodes: Record<string, NodeView>; roots: string[] }> {
  const api = await ctx.api();
  return ctx.cdp.evalJs(
    `fetch(${JSON.stringify(api)} + "/api/document?id=main").then(r => r.json())`,
  );
}

export async function resetDoc(ctx: Ctx): Promise<void> {
  const api = await ctx.api();
  await ctx.cdp.evalJs(
    `fetch(${JSON.stringify(api)} + "/api/document", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "main", name: "E2E", nodes: {}, roots: [] }) })`,
  );
}

export async function fresh(ctx: Ctx, mode: "document" | "catalog" = "document"): Promise<void> {
  await ctx.cdp.evalJs(
    `localStorage.setItem("cul_mode", ${JSON.stringify(mode)}); localStorage.setItem("cul_onboarded", "1"); localStorage.setItem("cul_lang", "ja"); localStorage.setItem("cul_sync", "0")`,
  );
  await resetDoc(ctx);
  await ctx.cdp.reload();
}

export const btn = (ctx: Ctx, label: string) =>
  ctx.cdp.evalJs<boolean>(
    `(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)} || b.getAttribute('aria-label') === ${JSON.stringify(label)} || b.title === ${JSON.stringify(label)}); if (!b) return false; b.click(); return true; })()`,
  );

export const rowClick = (ctx: Ctx, text: string, shift = false) =>
  ctx.cdp.evalJs(
    `(() => { const row = [...document.querySelectorAll('[draggable=true]')].find(r => r.textContent.includes(${JSON.stringify(text)})); if (!row) return false; row.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: ${shift} })); return true; })()`,
  );

export const selCount = (ctx: Ctx) =>
  ctx.cdp.evalJs<number>(`(window.__culSelection ?? []).length`);

export async function firstFrame(ctx: Ctx): Promise<NodeView | null> {
  const d = await getDoc(ctx);
  return Object.values(d.nodes).find((n) => n.kind === "frame") ?? null;
}

export async function createFrame(
  ctx: Ctx,
  a: { x: number; y: number },
  b: { x: number; y: number },
): Promise<NodeView | null> {
  await btn(ctx, "フレーム (F)");
  await sleep(300);
  await ctx.cdp.drag(await ctx.cdp.screen(a.x, a.y), await ctx.cdp.screen(b.x, b.y), { steps: 4 });
  return firstFrame(ctx);
}

export { sleep };

export async function waitSel(
  ctx: Ctx,
  pred: (n: number) => boolean,
  timeout = 4000,
): Promise<number> {
  const start = Date.now();
  let n = await selCount(ctx);
  while (!pred(n) && Date.now() - start < timeout) {
    await sleep(250);
    n = await selCount(ctx);
  }
  return n;
}
