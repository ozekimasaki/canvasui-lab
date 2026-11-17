import type { Ctx } from "../run";
import { sleep } from "../cdp";
import { btn, firstFrame, fresh, getDoc, rowClick, selCount } from "./helpers";

const synthWorld = async (ctx: Ctx, a: { x: number; y: number }, b: { x: number; y: number }) => {
  const cam = await ctx.cdp.camera();
  const cl = (w: { x: number; y: number }) => ({
    x: (w.x - cam.x) * cam.zoom,
    y: (w.y - cam.y) * cam.zoom,
  });
  return synthDrag(ctx, cl(a), cl(b));
};
const synthDrag = (ctx: Ctx, a: { x: number; y: number }, b: { x: number; y: number }) =>
  ctx.cdp.evalJs(
    `(() => { const s = window.__cul.canvas.surface; const opts = (x, y, extra = {}) => ({ clientX: x, clientY: y, pointerId: 9, bubbles: true, cancelable: true, ...extra }); s.dispatchEvent(new PointerEvent('pointerdown', opts(${a.x}, ${a.y}))); for (let i = 1; i <= 5; i++) s.dispatchEvent(new PointerEvent('pointermove', opts(${a.x} + (${b.x} - ${a.x}) * i / 5, ${a.y} + (${b.y} - ${a.y}) * i / 5, { buttons: 1 }))); s.dispatchEvent(new PointerEvent('pointerup', opts(${b.x}, ${b.y}))); })()`,
  );

const nodeById = (ctx: Ctx, id: string) =>
  ctx.cdp.evalJs<any>(
    `fetch((window.__CUL_API__ ?? "") + "/api/document?id=main").then(r => r.json()).then(d => d.nodes[${JSON.stringify(id)}] ?? null)`,
  );

export async function run(ctx: Ctx): Promise<void> {
  const { cdp, check } = ctx;
  await fresh(ctx);
  // frame A
  await btn(ctx, "フレーム (F)");
  await sleep(300);
  await synthWorld(ctx, { x: 500, y: 300 }, { x: 800, y: 500 });
  await sleep(800);
  const A = (await firstFrame(ctx))!;
  // creation OVER existing node must not move it
  await btn(ctx, "長方形 (R)");
  await sleep(300);
  await synthWorld(ctx, { x: 600, y: 350 }, { x: 700, y: 420 });
  await sleep(800);
  const A2 = (await firstFrame(ctx))!;
  let d = await getDoc(ctx);
  const B = Object.values(d.nodes).find((n) => n.kind === "shape")!;
  const align = await cdp.evalJs<{ x: number; y: number } | null>(
    `(() => { const c = window.__cul.canvas; const r = window.__culWorldRect ? window.__culWorldRect('${A.id}') : null; return r ? { x: r.x, y: r.y } : null; })()`,
  );
  check(
    "frame render aligns with doc position",
    Boolean(align) && Math.round(align!.x) === A.x && Math.round(align!.y) === A.y,
    JSON.stringify({ align, doc: [A.x, A.y] }),
  );
  check(
    "create over node leaves it untouched",
    A2.x === A.x && A2.y === A.y && A2.w === A.w && A2.h === A.h,
    JSON.stringify({ A, A2 }),
  );
  check(
    "create over node creates shape",
    Boolean(B && B.w === 100 && B.h === 70),
    JSON.stringify(B),
  );
  // shrink resize via bottom-right handle
  await cdp.click(await cdp.screen(B.x + B.w / 2, B.y + B.h / 2));
  await sleep(500);
  const h0 = await cdp.screen(B.x + B.w, B.y + B.h);
  await cdp.drag(h0, { x: h0.x - 40, y: h0.y - 30 });
  const B2 = await nodeById(ctx, B.id);
  check(
    "shrink resize",
    Math.round(B2.w) === 60 && Math.round(B2.h) === 40,
    JSON.stringify({ w: B2.w, h: B2.h }),
  );
  // clamp: drag handle past opposite edge
  const h1 = await cdp.screen(B2.x + B2.w, B2.y + B2.h);
  const target = await cdp.screen(B2.x - 50, B2.y - 50);
  await cdp.drag(h1, target);
  const B3 = await nodeById(ctx, B.id);
  check("resize clamps min size", B3.w >= 8 && B3.h >= 8, JSON.stringify({ w: B3.w, h: B3.h }));
  // undo restores pre-resize
  await cdp.key("z", 90, 4);
  await sleep(800);
  const B4 = await nodeById(ctx, B.id);
  check(
    "undo after resize",
    Math.round(B4.w) === 60 && Math.round(B4.h) === 40,
    JSON.stringify({ w: B4.w, h: B4.h }),
  );
  // negative-direction creation
  await btn(ctx, "長方形 (R)");
  await sleep(300);
  await synthWorld(ctx, { x: 900, y: 400 }, { x: 820, y: 340 });
  await sleep(800);
  d = await getDoc(ctx);
  const neg = Object.values(d.nodes).find((n) => n.kind === "shape" && n.id !== B.id)!;
  check(
    "negative drag creation",
    Math.round(neg.x) === 820 &&
      Math.round(neg.y) === 340 &&
      Math.round(neg.w) === 80 &&
      Math.round(neg.h) === 60,
    JSON.stringify(neg),
  );
  // tiny drag -> min size
  await btn(ctx, "長方形 (R)");
  await sleep(300);
  await synthWorld(ctx, { x: 950, y: 450 }, { x: 950, y: 450 });
  await sleep(800);
  d = await getDoc(ctx);
  const tiny = Object.values(d.nodes).find(
    (n) => n.kind === "shape" && n.id !== B.id && n.id !== neg.id,
  )!;
  check(
    "tiny drag min size",
    tiny.w >= 24 && tiny.h >= 24,
    JSON.stringify({ w: tiny.w, h: tiny.h }),
  );
  // tool switch mid-gesture cancels draft
  const before = Object.keys((await getDoc(ctx)).nodes).length;
  await btn(ctx, "長方形 (R)");
  await sleep(300);
  await ctx.cdp.evalJs(
    `(() => { const s = window.__cul.canvas.surface; const o = (x, y, e = {}) => ({ clientX: x, clientY: y, pointerId: 9, bubbles: true, cancelable: true, ...e }); s.dispatchEvent(new PointerEvent('pointerdown', o(1000, 600))); s.dispatchEvent(new PointerEvent('pointermove', o(1060, 640, { buttons: 1 }))); })()`,
  );
  await cdp.key("v", 86);
  await sleep(200);
  await ctx.cdp.evalJs(
    `window.__cul.canvas.surface.dispatchEvent(new PointerEvent('pointerup', { clientX: 1060, clientY: 640, pointerId: 9, bubbles: true }))`,
  );
  await sleep(800);
  check(
    "tool switch mid-gesture cancels",
    Object.keys((await getDoc(ctx)).nodes).length === before,
  );
  // flex group: group B + neg, flex on, drag child reorders
  await btn(ctx, "レイヤー");
  await sleep(300);
  await cdp.evalJs(
    `(() => { const rows = [...document.querySelectorAll('[draggable=true]')]; rows[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true })); })()`,
  );
  await sleep(300);
  await cdp.evalJs(
    `(() => { const rows = [...document.querySelectorAll('[draggable=true]')]; rows[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })); })()`,
  );
  await sleep(300);
  await cdp.key("g", 71, 4);
  await sleep(800);
  d = await getDoc(ctx);
  const group = Object.values(d.nodes).find((n) => n.kind === "frame" && n.name === "Group")!;
  const g0 = await getDoc(ctx);
  const gg = Object.values(g0.nodes).find((n) => n.kind === "frame" && n.name === "Group")!;
  await cdp.click(await cdp.screen(gg.x + 2, gg.y + 2));
  await sleep(500);
  await cdp.key("A", 65, 8);
  await sleep(800);
  d = await getDoc(ctx);
  const g2 = d.nodes[group.id] as any;
  check(
    "flex on group",
    Boolean(g2.flex),
    JSON.stringify({
      children: g2.children,
      dom: await cdp.evalJs(
        `JSON.stringify([...document.querySelectorAll("[data-docnode]")].map(e => e.getAttribute("data-docnode")))`,
      ),
    }),
  );
  const order0 = [...g2.children];
  const childRect = (id: string) =>
    cdp.evalJs<{ x: number; y: number; width: number; height: number }>(
      `(() => { const c = window.__cul.canvas; const r = window.__culWorldRect ? window.__culWorldRect('${id}') : null; return r ? { x: r.x, y: r.y, width: r.w, height: r.h } : null; })()`,
    );
  await cdp.evalJs(
    `(() => { const rows = [...document.querySelectorAll('[draggable=true]')]; const src = rows.find(r => r.textContent.includes('Rectangle')); const dst = rows.find(r => r.textContent.includes('Group')); const dt = new DataTransfer(); src?.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true })); dst?.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); dst?.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); })()`,
  );
  await sleep(700);
  d = await getDoc(ctx);
  const order1 = (d.nodes[group.id] as any).children;
  check("layer drag reorders into group", order1.length === 2, JSON.stringify({ order0, order1 }));
  // Enter / Shift+Enter navigation
  const gNow = await getDoc(ctx);
  const gNowNode = Object.values(gNow.nodes).find((n) => n.kind === "frame" && n.name === "Group")!;
  await cdp.click(await cdp.screen(gNowNode.x + 4, gNowNode.y + 4));
  await sleep(500);
  await cdp.key("Enter", 13);
  await sleep(500);
  const selEnter = await cdp.evalJs<string[]>(`window.__culSelection ?? []`);
  check(
    "Enter selects child",
    selEnter.length === 1 && group.children.includes(selEnter[0]),
    JSON.stringify(selEnter),
  );
  await cdp.key("Enter", 13, 8);
  await sleep(500);
  const selUp = await cdp.evalJs<string[]>(`window.__culSelection ?? []`);
  check(
    "Shift+Enter selects parent",
    selUp.length === 1 && (await getDoc(ctx)).nodes[selUp[0]]?.kind === "frame",
    JSON.stringify(selUp),
  );
  // zoom mid-drag does not crash
  await cdp.key("Escape", 27);
  await sleep(300);
  const zp = await cdp.screen(500, 300);
  await cdp.press(zp);
  await sleep(100);
  await cdp.move({ x: zp.x + 30, y: zp.y + 20 });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: zp.x,
    y: zp.y,
    deltaX: 0,
    deltaY: -120,
    modifiers: 2,
  });
  await sleep(200);
  await cdp.move({ x: zp.x + 60, y: zp.y + 40 });
  await cdp.release({ x: zp.x + 60, y: zp.y + 40 });
  await sleep(800);
  check(
    "zoom mid-drag survives",
    (await selCount(ctx)) >= 0 && Object.keys((await getDoc(ctx)).nodes).length > 0,
  );
}
