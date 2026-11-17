import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Ctx } from "../run";
import { sleep } from "../cdp";
import { btn, createFrame, firstFrame, fresh, getDoc, rowClick } from "./helpers";

export async function run(ctx: Ctx): Promise<void> {
  const { cdp, check } = ctx;
  await fresh(ctx);
  await createFrame(ctx, { x: 500, y: 300 }, { x: 800, y: 500 });
  // layers rename / eye / search
  const rowRect = await cdp.evalJs<{ x: number; y: number }>(
    `(() => { const row = [...document.querySelectorAll('[draggable=true]')].find(r => r.textContent.includes('Frame')); const r = row.getBoundingClientRect(); return { x: r.x + 60, y: r.y + r.height / 2 }; })()`,
  );
  await cdp.dblclick(rowRect);
  await sleep(400);
  check(
    "layer rename input",
    await cdp.evalJs(
      `Boolean([...document.querySelectorAll('input')].find(i => i.defaultValue === 'Frame'))`,
    ),
  );
  await cdp.key("Escape", 27);
  await sleep(300);
  const hiddenBefore = (await firstFrame(ctx))!.hidden ?? false;
  await cdp.evalJs(
    `(() => { const row = [...document.querySelectorAll('[draggable=true]')].find(r => r.textContent.includes('Frame')); row.querySelector('button')?.click(); })()`,
  );
  await sleep(600);
  check("layer eye toggles", ((await firstFrame(ctx))!.hidden ?? false) !== hiddenBefore);
  await cdp.evalJs(
    `(() => { const row = [...document.querySelectorAll('[draggable=true]')].find(r => r.textContent.includes('Frame')); row.querySelector('button')?.click(); })()`,
  );
  await sleep(400);
  await cdp.key("f", 70, 4);
  await sleep(400);
  check(
    "Cmd+F search opens",
    await cdp.evalJs(
      `Boolean([...document.querySelectorAll('input')].find(i => i.placeholder.includes('レイヤーを検索')))`,
    ),
  );
  await cdp.evalJs(
    `(() => { const i = [...document.querySelectorAll('input')].find(i => i.placeholder.includes('レイヤーを検索')); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(i, 'zzz'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`,
  );
  await sleep(400);
  check(
    "search filters rows",
    await cdp.evalJs(
      `[...document.querySelectorAll('[draggable=true]')].filter(r => r.textContent.includes('Frame')).length === 0`,
    ),
  );
  await cdp.key("Escape", 27);
  await sleep(300);
  // assets drag insert
  await btn(ctx, "アセット");
  await sleep(500);
  check(
    "assets thumbs",
    (await cdp.evalJs<number>(`document.querySelectorAll('[draggable=true]').length`)) >= 6,
  );
  await cdp.evalJs(
    `(() => { const s = window.__cul.canvas.surface; const first = document.querySelector('[draggable=true]'); const dt = new DataTransfer(); first.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true })); s.dispatchEvent(new DragEvent('dragover', { clientX: 700, clientY: 600, dataTransfer: dt, bubbles: true, cancelable: true })); s.dispatchEvent(new DragEvent('drop', { clientX: 700, clientY: 600, dataTransfer: dt, bubbles: true, cancelable: true })); })()`,
  );
  await sleep(800);
  let d = await getDoc(ctx);
  const inst = Object.values(d.nodes).find((n) => n.kind === "instance");
  check("assets drag inserts instance", Boolean(inst));
  // instance prop select persists
  await btn(ctx, "レイヤー");
  await sleep(400);
  await rowClick(ctx, inst!.name);
  await sleep(500);
  check(
    "instance props section",
    await cdp.evalJs(`document.body.textContent.includes('コンポーネント')`),
  );
  await cdp.evalJs(
    `(() => { const right = [...document.querySelectorAll('.cul-panel')].find(p => { const r = p.getBoundingClientRect(); return r.right > innerWidth - 40 && r.width < 300; }); const sel = right.querySelector('select'); const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set; set.call(sel, sel.options[1].value); sel.dispatchEvent(new Event('change', { bubbles: true })); })()`,
  );
  await sleep(800);
  d = await getDoc(ctx);
  check(
    "instance prop persists",
    Object.values(d.nodes).some(
      (n) => n.kind === "instance" && Object.keys(n.overrides ?? {}).length > 0,
    ),
  );
  // className write-back to temp project
  const target = join(ctx.projectDir, "src/components/Alert/Alert.tsx");
  const before = readFileSync(target, "utf8");
  await cdp.evalJs(
    `(() => { const right = [...document.querySelectorAll('.cul-panel')].find(p => { const r = p.getBoundingClientRect(); return r.right > innerWidth - 40 && r.width < 300; }); const i = [...right.querySelectorAll('input')].find(i => i.placeholder.includes('flex items-center')); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(i, 'e2e-class'); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('blur', { bubbles: true })); })()`,
  );
  await sleep(400);
  await cdp.evalJs(
    `(() => { const right = [...document.querySelectorAll('.cul-panel')].find(p => { const r = p.getBoundingClientRect(); return r.right > innerWidth - 40 && r.width < 300; }); [...right.querySelectorAll('button')].find(b => b.textContent.includes('ソースに書き戻す'))?.click(); })()`,
  );
  await sleep(1500);
  const afterClass = readFileSync(target, "utf8");
  check(
    "className write-back hits temp project",
    afterClass.includes("e2e-class") && afterClass !== before,
  );
  // HTML copy
  await rowClick(ctx, "Frame");
  await sleep(400);
  await cdp.key("c", 67, 4 | 1);
  await sleep(800);
  check(
    "Cmd+Opt+C html clipboard",
    await cdp.evalJs(
      `navigator.clipboard.readText().then(t => t.includes('data-docnode')).catch(() => false)`,
    ),
  );
  // Monaco open + edit + apply + native undo (temp project)
  await btn(ctx, "コード");
  await sleep(400);
  await cdp.evalJs(
    `(() => { const right = [...document.querySelectorAll('.cul-panel')].find(p => { const r = p.getBoundingClientRect(); return r.right > innerWidth - 40 && r.width < 300; }); [...right.querySelectorAll('button')].find(b => !b.closest('.cul-panel-header'))?.click(); })()`,
  );
  await sleep(6000);
  check("Monaco opens", await cdp.evalJs(`Boolean(document.querySelector('.monaco-editor'))`));
  check(
    "editor is centered modal",
    await cdp.evalJs(
      `(() => { const ed = [...document.querySelectorAll('.cul-panel')].find(p => p.querySelector('.monaco-editor')); if (!ed) return false; const r = ed.getBoundingClientRect(); return Math.abs(r.x + r.width / 2 - innerWidth / 2) < 40 && getComputedStyle(ed).position === 'fixed'; })()`,
    ),
  );
  const orig = readFileSync(target, "utf8");
  await cdp.evalJs(
    `window.__culEditor.setValue(window.__culEditor.getValue().replace('Heads up', 'E2E Edited'))`,
  );
  await sleep(300);
  await cdp.evalJs(
    `[...document.querySelectorAll('button')].find(b => b.textContent.includes('ソースに適用'))?.click()`,
  );
  await sleep(2000);
  const edited = readFileSync(target, "utf8");
  check("Monaco apply patches temp file", edited.includes("E2E Edited"));
  check(
    "native undo restores file",
    await cdp.evalJs(`window.__CUL_NATIVE__.undo()`).then(async (ok) => {
      await sleep(500);
      return ok && readFileSync(target, "utf8") === orig;
    }),
  );
  await cdp.evalJs(
    `[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'エディタを閉じる')?.click()`,
  );
  await sleep(400);
  // embedded tabs contained
  for (const [tab, title] of [
    ["変数", "デザイン同期"],
    ["マーク", "マーク"],
  ] as const) {
    await btn(ctx, tab);
    await sleep(600);
    check(
      `${tab} tab contained`,
      await cdp.evalJs(
        `(() => { const right = [...document.querySelectorAll('.cul-panel')].find(p => { const r = p.getBoundingClientRect(); return r.right > innerWidth - 40 && r.width < 300; }); const inner = right.querySelector('.cul-panel'); if (!inner) return false; const a = inner.getBoundingClientRect(), b = right.getBoundingClientRect(); return a.left >= b.left - 4 && a.right <= b.right + 4 && a.width <= b.width + 4; })()`,
      ),
    );
  }
}
