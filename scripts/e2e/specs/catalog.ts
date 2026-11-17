import type { Ctx } from "../run";
import { sleep } from "../cdp";
import { btn, fresh } from "./helpers";

export async function run(ctx: Ctx): Promise<void> {
  const { cdp, check } = ctx;
  await fresh(ctx, "catalog");
  await sleep(2500);
  check(
    "catalog cells render",
    (await cdp.evalJs<number>(`document.querySelectorAll('[data-cellkey]').length`)) >= 100,
  );
  check("gpu or dom badge", await cdp.evalJs(`Boolean(document.querySelector('.cul-badge'))`));
  // interact toggle
  await btn(ctx, "インタラクト");
  await sleep(300);
  check(
    "interact toggles to edit",
    await cdp.evalJs(
      `[...document.querySelectorAll('button')].some(b => b.textContent.trim() === '編集')`,
    ),
  );
  await btn(ctx, "編集");
  await sleep(300);
  // select a cell via shift-click at its world rect
  const pt = await cdp.evalJs<{ x: number; y: number } | null>(
    `(() => { const c = window.__cul.canvas; const el = document.querySelector('[data-cellkey]'); if (!el) return null; const node = c.getNodeOf(el); const r = c.getNodeRect(node); const cam = c.getCamera(); const sr = c.surface.getBoundingClientRect(); return { x: (r.x + r.width / 2 - cam.x) * cam.zoom + sr.x, y: (r.y + r.height / 2 - cam.y) * cam.zoom + sr.y }; })()`,
  );
  if (pt) {
    await cdp.click(pt, 8);
    await sleep(800);
    check(
      "inspector opens on shift-click",
      await cdp.evalJs(`document.body.textContent.includes('ベースライン承認')`),
    );
    // note -> marks
    await cdp.evalJs(
      `(() => { const ta = document.querySelector('textarea'); const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; set.call(ta, 'e2e note'); ta.dispatchEvent(new Event('input', { bubbles: true })); })()`,
    );
    await sleep(300);
    await btn(ctx, "メモをピン");
    await sleep(1000);
    check(
      "note pinned toast",
      await cdp.evalJs(`document.body.textContent.includes('メモをピンしました')`),
    );
    // baseline approve
    await btn(ctx, "ベースライン承認");
    await sleep(2500);
    check(
      "baseline approved",
      await cdp.evalJs(`document.body.textContent.includes('ベースライン承認:')`),
    );
  } else {
    check("cell hit rect available", false);
  }
  // VRT run
  await btn(ctx, "VRT 実行");
  let vrtDone = false;
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    if (await cdp.evalJs(`document.body.textContent.includes('VRT 完了')`)) {
      vrtDone = true;
      break;
    }
  }
  check(
    "VRT completes",
    vrtDone,
    vrtDone
      ? undefined
      : await cdp.evalJs(
          "document.querySelector('.cul-status')?.textContent ?? document.body.textContent.slice(-160)",
        ),
  );
  // marks panel list + delete
  await cdp.evalJs(
    `(() => { const p = [...document.querySelectorAll('.cul-panel')].find(p => p.textContent.includes('マーク') && p.querySelector('ul')); if (!p) return; const head = p.querySelector('.cul-panel-header'); head?.click(); })()`,
  );
  await sleep(600);
  const marksBefore = await cdp.evalJs<number>(
    `fetch((window.__CUL_API__ ?? '') + '/api/marks').then(r => r.json()).then(d => Array.isArray(d) ? d.length : (d.marks ?? []).length)`,
  );
  check("marks exist after note", marksBefore >= 1, String(marksBefore));
  // design tokens tab
  check(
    "tokens api",
    await cdp.evalJs(`fetch((window.__CUL_API__ ?? '') + '/api/tokens').then(r => r.ok)`),
  );
  // theme cycle
  await cdp.evalJs(`document.querySelector('button[aria-label^="テーマ"]')?.click()`);
  await sleep(300);
  check(
    "theme light attr",
    await cdp.evalJs(`document.documentElement.getAttribute('data-chrome') === 'light'`),
  );
  await cdp.evalJs(`document.querySelector('button[aria-label^="テーマ"]')?.click()`);
  await sleep(300);
  check(
    "theme dark attr",
    await cdp.evalJs(`document.documentElement.getAttribute('data-chrome') === 'dark'`),
  );
  await cdp.evalJs(`document.querySelector('button[aria-label^="テーマ"]')?.click()`);
  await sleep(300);
  // lang toggle
  await btn(ctx, "English");
  await sleep(400);
  check("lang en", await cdp.evalJs(`document.documentElement.lang === 'en'`));
  await btn(ctx, "日本語");
  await sleep(400);
  check("lang ja", await cdp.evalJs(`document.documentElement.lang === 'ja'`));
  // history in-app panel
  await btn(ctx, "履歴");
  await sleep(1200);
  check(
    "history panel opens",
    await cdp.evalJs(
      `(() => { const p = [...document.querySelectorAll('.cul-panel')].find(p => p.textContent.includes('履歴') && p.querySelector('.cul-panel-header')); return Boolean(p); })()`,
    ),
  );
  check(
    "history lists runs",
    await cdp.evalJs(
      `(() => { const p = [...document.querySelectorAll('.cul-panel')].find(p => p.textContent.includes('履歴') && p.querySelector('.cul-panel-header')); return p ? p.querySelectorAll('button').length >= 2 : false; })()`,
    ),
  );
}
