import type { Ctx } from "../run";
import { sleep } from "../cdp";
import { fresh } from "./helpers";

export async function run(ctx: Ctx): Promise<void> {
  const { cdp, check } = ctx;
  await fresh(ctx);
  await sleep(600);
  const info = await cdp.evalJs<{ heights: number[]; accents: string[] }>(`(() => {
    const btns = [...document.querySelectorAll('.cul-btn')].filter(b => b.getBoundingClientRect().height > 0);
    const heights = [...new Set(btns.map(b => Math.round(b.getBoundingClientRect().height)))];
    const accents = [...new Set([...document.querySelectorAll('.cul-btn-primary, .cul-btn[aria-pressed="true"], .cul-btn[aria-selected="true"]')].map(b => getComputedStyle(b).backgroundColor))];
    return { heights, accents };
  })()`);
  check(
    "buttons: two-size scale",
    info.heights.every((h) => h === 24 || h === 32),
    JSON.stringify(info.heights),
  );
  check("buttons: single accent family", info.accents.length <= 2, JSON.stringify(info.accents));
  await cdp.screenshot(ctx.artifactsDir + "/buttons-ja.png");
}
