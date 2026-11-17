import type { Ctx } from "../run";
import { sleep } from "../cdp";
import { btn, fresh, rowClick } from "./helpers";

const DETECT = `(() => {
  const W = innerWidth, H = innerHeight;
  const chrome = [...document.querySelectorAll('.cul-panel, .cul-toolbar')].filter(p => { const r = p.getBoundingClientRect(); return r.width > 60 && r.height > 40 && getComputedStyle(p).visibility !== 'hidden'; });
  const overlays = [...document.querySelectorAll('div')].filter(d => { const cs = getComputedStyle(d); const z = Number(cs.zIndex); const r = d.getBoundingClientRect(); return (cs.position === 'fixed' || cs.position === 'absolute') && z >= 40 && r.width > W * 0.5 && r.height > H * 0.5; });
  const inOverlay = (el) => overlays.some(o => o.contains(el));
  const named = chrome.map(p => { const r = p.getBoundingClientRect(); return { el: p, r, label: (p.textContent || '').slice(0, 14) }; }).filter(n => !inOverlay(n.el));
  const overlaps = [];
  for (let i = 0; i < named.length; i++) for (let j = i + 1; j < named.length; j++) {
    const a = named[i], b = named[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (ox > 8 && oy > 8) overlaps.push(a.label + ' x ' + b.label);
  }
  const overflow = [];
  for (const p of chrome) {
    const cs = getComputedStyle(p);
    if (cs.overflowX === 'visible' && p.scrollWidth > p.clientWidth + 2) overflow.push('x:' + (p.textContent || '').slice(0, 14));
    if (cs.overflowY === 'visible' && p.scrollHeight > p.clientHeight + 2) overflow.push('y:' + (p.textContent || '').slice(0, 14));
  }
  const offview = named.filter(n => n.r.right > W + 2 || n.r.left < -2 || n.r.bottom > H + 2 || n.r.top < -2).map(n => n.label);
  const covered = [];
  if (overlays.length === 0) for (const p of chrome) for (const b of p.querySelectorAll('button')) {
    const r = b.getBoundingClientRect(); if (r.width < 4) continue;
    const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (at && !b.contains(at) && !at.contains(b)) covered.push((b.getAttribute('aria-label') || b.textContent || '').slice(0, 12));
  }
  return { overlaps, overflow, offview, covered };
})()`;

const forceMode = (ctx: Ctx, mode: "doc" | "catalog") =>
  ctx.cdp.evalJs(
    `(() => { const want = ${JSON.stringify(mode === "doc" ? ["ドキュメント", "Document"] : ["カタログ", "Catalog"])}; const tab = [...document.querySelectorAll('[role=tab]')].find(b => want.some(w => b.textContent.includes(w))); if (tab) { tab.click(); return; } const btn = [...document.querySelectorAll('button')].find(b => want.some(w => b.textContent.trim() === w)); btn?.click(); })()`,
  );

export async function run(ctx: Ctx): Promise<void> {
  const { cdp, check } = ctx;
  for (const [w, h] of [
    [1600, 1000],
    [1280, 800],
    [1024, 768],
  ] as const) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: w,
      height: h,
      deviceScaleFactor: 1,
      mobile: false,
    });
    for (const theme of ["light", "dark"] as const) {
      for (const lang of ["ja", "en"] as const) {
        await cdp.evalJs(`localStorage.setItem("cul_lang", ${JSON.stringify(lang)})`);
        for (const state of [
          "doc-empty",
          "doc-nodes",
          "doc-editor",
          "doc-chat",
          "catalog",
        ] as const) {
          if (state === "doc-empty") {
            await cdp.evalJs(`localStorage.removeItem("cul_onboarded")`);
            await fresh(ctx);
            await cdp.evalJs(`localStorage.removeItem("cul_onboarded")`);
            await cdp.reload();
          } else if (state === "doc-nodes") {
            await cdp.evalJs(`localStorage.setItem("cul_onboarded", "1")`);
            await forceMode(ctx, "doc");
            await sleep(600);
            await cdp.setFileInput("input[type=file]", [
              process.cwd() + "/tests/fixtures/circle.fig",
            ]);
            await sleep(1800);
            await rowClick(ctx, "Frame");
            await sleep(400);
          } else if (state === "doc-editor") {
            await btn(ctx, lang === "ja" ? "コード" : "Code");
            await sleep(400);
            await cdp.evalJs(
              `(() => { const right = [...document.querySelectorAll('.cul-panel')].find(p => { const r = p.getBoundingClientRect(); return r.right > innerWidth - 40 && r.width < 300; }); [...right.querySelectorAll('button')].find(b => !b.closest('.cul-panel-header'))?.click(); })()`,
            );
            await sleep(2500);
          } else if (state === "doc-chat") {
            await cdp.evalJs(
              `[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'エディタを閉じる' || b.getAttribute('aria-label') === 'Close editor')?.click()`,
            );
            await sleep(400);
            await cdp.evalJs(
              `[...document.querySelectorAll('button')].find(b => b.title && b.title.includes('Cmd+K'))?.click()`,
            );
            await sleep(600);
          } else {
            await cdp.evalJs(
              `[...document.querySelectorAll('button')].find(b => b.title && b.title.includes('Cmd+K'))?.click()`,
            );
            await sleep(300);
            await forceMode(ctx, "catalog");
            await sleep(2500);
          }
          await cdp.evalJs(
            `document.documentElement.setAttribute("data-chrome", ${JSON.stringify(theme)})`,
          );
          await sleep(300);
          const d = await cdp.evalJs<{
            overlaps: string[];
            overflow: string[];
            offview: string[];
            covered: string[];
          }>(DETECT);
          const bad = d.overlaps.length + d.overflow.length + d.offview.length + d.covered.length;
          check(
            `layout ${w}x${h} ${theme} ${lang} ${state}`,
            bad === 0,
            bad ? JSON.stringify(d) : undefined,
          );
          if (w === 1600 && theme === "light" && lang === "ja" && state !== "doc-empty") {
            await cdp.screenshot(ctx.artifactsDir + `/layout-${state}.png`);
          }
        }
      }
    }
  }
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
}
