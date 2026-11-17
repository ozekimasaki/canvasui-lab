import type { Ctx } from "../run";
import { sleep } from "../cdp";
import {
  btn,
  createFrame,
  firstFrame,
  fresh,
  getDoc,
  rowClick,
  selCount,
  waitSel,
} from "./helpers";

export async function run(ctx: Ctx): Promise<void> {
  const { cdp, check } = ctx;
  await fresh(ctx);
  // tool switching
  const tools: [string, number, string][] = [
    ["v", 86, "移動 (V)"],
    ["h", 72, "手のひら (H)"],
    ["f", 70, "フレーム (F)"],
    ["t", 84, "テキスト (T)"],
    ["c", 67, "コメント (C)"],
    ["a", 65, "アセット (A)"],
    ["r", 82, "長方形 (R)"],
    ["o", 79, "楕円 (O)"],
    ["z", 90, "ズーム (Z)"],
  ];
  for (const [k, vk, label] of tools) {
    await cdp.key(k, vk);
    await sleep(150);
    check(
      `tool ${k}`,
      await cdp.evalJs(
        `document.querySelector('button[aria-label=${JSON.stringify(label)}]')?.getAttribute('aria-pressed') === "true"`,
      ),
    );
  }
  await cdp.key("v", 86);
  await sleep(150);
  await btn(ctx, "レイヤー");
  await sleep(300);
  // creation
  const f = await createFrame(ctx, { x: 500, y: 300 }, { x: 800, y: 500 });
  check(
    "F creates exact rect",
    Boolean(f && f.w === 300 && f.h === 200 && f.x === 500 && f.y === 300),
    JSON.stringify(f),
  );
  // drag selected exact
  const f0 = f!;
  await rowClick(ctx, "Frame");
  await sleep(400);
  const a = await cdp.screen(f0.x + f0.w / 2, f0.y + f0.h / 2);
  await cdp.drag(a, { x: a.x + 100, y: a.y + 50 });
  const f1 = (await firstFrame(ctx))!;
  const dd1 = await getDoc(ctx);
  check(
    "drag selected exact",
    Math.round(f1.x - f0.x) === 100 &&
      Math.round(f1.y - f0.y) === 50 &&
      Object.keys(dd1.nodes).length === 1,
    JSON.stringify({ dx: f1.x - f0.x, dy: f1.y - f0.y, count: Object.keys(dd1.nodes).length }),
  );
  // drag unselected exact
  await cdp.key("Escape", 27);
  await sleep(400);
  const b = await cdp.screen(f1.x + 30, f1.y + 30);
  await cdp.drag(b, { x: b.x - 80, y: b.y - 60 });
  const f2 = (await firstFrame(ctx))!;
  const dd2 = await getDoc(ctx);
  check(
    "drag unselected exact",
    Math.round(f2.x - f1.x) === -80 &&
      Math.round(f2.y - f1.y) === -60 &&
      Object.keys(dd2.nodes).length === 1,
    JSON.stringify({ dx: f2.x - f1.x, dy: f2.y - f1.y }),
  );
  // resize handle exact
  await rowClick(ctx, "Frame");
  await sleep(400);
  const h0 = await cdp.screen(f2.x + f2.w, f2.y + f2.h);
  await cdp.drag(h0, { x: h0.x + 120, y: h0.y + 80 });
  const f3 = (await firstFrame(ctx))!;
  check(
    "resize handle exact",
    Math.round(f3.w - f2.w) === 120 && Math.round(f3.h - f2.h) === 80,
    JSON.stringify({ dw: f3.w - f2.w, dh: f3.h - f2.h }),
  );
  await btn(ctx, "テキスト (T)");
  await sleep(250);
  await cdp.click(await cdp.screen(900, 300));
  await sleep(600);
  const dd3 = await getDoc(ctx);
  check(
    "T inserts text",
    Object.values(dd3.nodes).some((n) => n.kind === "text"),
  );
  await btn(ctx, "長方形 (R)");
  await sleep(250);
  await cdp.drag(await cdp.screen(1000, 300), await cdp.screen(1080, 380), { steps: 4 });
  await btn(ctx, "楕円 (O)");
  await sleep(250);
  await cdp.drag(await cdp.screen(1150, 300), await cdp.screen(1230, 380), { steps: 4 });
  const dd4 = await getDoc(ctx);
  check("R/O shapes", Object.values(dd4.nodes).filter((n) => n.kind === "shape").length === 2);
  await btn(ctx, "コメント (C)");
  await sleep(250);
  await cdp.click(await cdp.screen(600, 600));
  await sleep(300);
  check(
    "C comment overlay",
    await cdp.evalJs(
      `Boolean([...document.querySelectorAll('input')].find(i => (i.placeholder === 'Comment…' || i.placeholder === 'コメント…')))`,
    ),
  );
  await cdp.key("Escape", 27);
  await sleep(200);
  await cdp.key("v", 86);
  await sleep(200);
  // nudge
  await rowClick(ctx, "Frame");
  await sleep(400);
  const x0 = f3.x;
  await cdp.key("ArrowRight", 39);
  await sleep(800);
  const x1 = (await firstFrame(ctx))!.x;
  check("nudge 1px", Math.round(x1 - x0) === 1, `${x0}->${x1}`);
  await cdp.key("ArrowRight", 39, 8);
  await sleep(800);
  const x2 = (await firstFrame(ctx))!.x;
  check("shift nudge 10px", Math.round(x2 - x1) === 10);
  // undo/redo
  await cdp.key("z", 90, 4);
  await sleep(800);
  check("undo nudge", Math.round((await firstFrame(ctx))!.x - x1) === 0);
  await cdp.key("z", 90, 4 | 8);
  await sleep(800);
  check("redo nudge", Math.round((await firstFrame(ctx))!.x - x2) === 0);
  // duplicate
  await rowClick(ctx, "Frame");
  await sleep(400);
  const n0 = Object.keys((await getDoc(ctx)).nodes).length;
  await cdp.key("d", 68, 4);
  await sleep(800);
  check("duplicate", Object.keys((await getDoc(ctx)).nodes).length === n0 + 1);
  await cdp.key("z", 90, 4);
  await sleep(800);
  // group / ungroup with selection follow
  await cdp.key("a", 65, 4);
  await sleep(400);
  await cdp.key("g", 71, 4);
  await sleep(800);
  let d = await getDoc(ctx);
  const group = Object.values(d.nodes).find((n) => n.kind === "frame" && n.name === "Group");
  check("group created", Boolean(group));
  check("group selected", (await waitSel(ctx, (n) => n === 1)) === 1, String(await selCount(ctx)));
  await cdp.key("g", 71, 4 | 8);
  await sleep(800);
  d = await getDoc(ctx);
  check(
    "ungroup restores",
    !Object.values(d.nodes).some((n) => n.name === "Group") &&
      (await waitSel(ctx, (n) => n >= 3)) >= 3,
    JSON.stringify({
      group: Object.values(d.nodes).some((n) => n.name === "Group"),
      sel: await selCount(ctx),
    }),
  );
  // cut / paste
  await btn(ctx, "レイヤー");
  await sleep(300);
  await rowClick(ctx, "Frame");
  await sleep(400);
  const nc = Object.keys((await getDoc(ctx)).nodes).length;
  await cdp.key("x", 88, 4);
  await sleep(800);
  check(
    "cut removes",
    Object.keys((await getDoc(ctx)).nodes).length === nc - 1,
    JSON.stringify({
      nc,
      now: Object.keys((await getDoc(ctx)).nodes).length,
      sel: await selCount(ctx),
    }),
  );
  await cdp.key("v", 86, 4);
  await sleep(800);
  check("paste restores count", Object.keys((await getDoc(ctx)).nodes).length === nc);
  // align
  await cdp.key("a", 65, 4);
  await sleep(400);
  await cdp.key("a", 65, 1);
  await sleep(800);
  d = await getDoc(ctx);
  const xs = d.roots
    .map((id) => d.nodes[id])
    .filter(Boolean)
    .map((n) => Math.round(n.x));
  check("opt+A align left", new Set(xs).size === 1, JSON.stringify(xs));
  // flex on/off
  await rowClick(ctx, "Frame");
  await sleep(400);
  await cdp.key("A", 65, 8);
  await sleep(800);
  check("shift+A flex on", Boolean((await firstFrame(ctx))!.flex));
  await cdp.key("A", 65, 8 | 1);
  await sleep(800);
  check("shift+opt+A flex off", !(await firstFrame(ctx))!.flex);
  // marquee shift-drag
  await cdp.key("Escape", 27);
  await sleep(300);
  const m0 = await cdp.screen(450, 250);
  const m1 = await cdp.screen(1300, 700);
  await cdp.drag(m0, m1, { mod: 8, steps: 5, after: 1500 });
  check(
    "shift-drag marquee multi",
    (await selCount(ctx)) >= 3,
    JSON.stringify({
      sel: await selCount(ctx),
      nodes: Object.keys((await getDoc(ctx)).nodes).length,
    }),
  );
  await cdp.key("Escape", 27);
  await sleep(300);
  check("esc clears", (await selCount(ctx)) === 0);
}
