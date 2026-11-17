import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Ctx } from "../run";
import { sleep } from "../cdp";
import { fresh } from "./helpers";

export async function run(ctx: Ctx): Promise<void> {
  const { cdp, check } = ctx;
  const axe = readFileSync(join(process.cwd(), "node_modules/axe-core/axe.min.js"), "utf8");
  for (const [lang, theme] of [
    ["ja", "light"],
    ["ja", "dark"],
    ["en", "light"],
  ] as const) {
    await cdp.evalJs(`localStorage.setItem("cul_lang", ${JSON.stringify(lang)})`);
    await fresh(ctx);
    await cdp.evalJs(
      `document.documentElement.setAttribute("data-chrome", ${JSON.stringify(theme)})`,
    );
    await sleep(600);
    await cdp.evalJs(axe);
    const results = await cdp.evalJs<{
      violations: { id: string; impact: string; nodes: unknown[] }[];
    }>(
      `axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }).then(r => ({ violations: r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })) }))`,
    );
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    check(
      `a11y ${lang}/${theme} no serious/critical`,
      serious.length === 0,
      JSON.stringify(serious),
    );
    check(`a11y ${lang}/${theme} report`, true, JSON.stringify(results.violations));
  }
}
