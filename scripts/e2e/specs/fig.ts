import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as babelParse } from "@babel/parser";
import type { Ctx } from "../run";
import { sleep } from "../cdp";
import { fresh, getDoc } from "./helpers";

export async function run(ctx: Ctx): Promise<void> {
  const { cdp, check } = ctx;
  await fresh(ctx);
  await cdp.setFileInput("input[type=file]", [process.cwd() + "/tests/fixtures/circle.fig"]);
  await sleep(2500);
  let d = await getDoc(ctx);
  check(
    "circle.fig imports nodes",
    Object.keys(d.nodes).length >= 2,
    String(Object.keys(d.nodes).length),
  );
  check("import toast", await cdp.evalJs(`document.body.textContent.includes('取り込みました')`));
  await cdp.setFileInput("input[type=file]", [
    process.cwd() + "/tests/fixtures/curvy-squiggle.fig",
  ]);
  await sleep(2500);
  check(
    "fidelity report modal",
    await cdp.evalJs(`document.body.textContent.includes('取り込みレポート')`),
  );
  await cdp.screenshot(ctx.artifactsDir + "/fidelity-modal.png");
  await cdp.evalJs(
    `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '閉じる')?.click()`,
  );
  await sleep(400);
  check(
    "report modal closes",
    await cdp.evalJs(`!document.body.textContent.includes('取り込みレポート')`),
  );
  // component generation via API into temp project (UI fixtures have no COMPONENT node)
  const api = await ctx.api();
  const ir = await cdp.evalJs(
    `fetch(${JSON.stringify(api)} + "/api/document?id=main").then(r => r.json())`,
  );
  const compIr = {
    nodes: [
      {
        id: "c1",
        type: "COMPONENT",
        name: "E2E Card",
        x: 0,
        y: 0,
        w: 200,
        h: 100,
        fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 } }],
      },
      {
        id: "t1",
        type: "TEXT",
        name: "label",
        x: 8,
        y: 8,
        w: 100,
        h: 20,
        text: { characters: "Hi", size: 14, weight: 400, color: "#000", align: "left" },
      },
      {
        id: "i1",
        type: "INSTANCE",
        name: "card inst",
        x: 250,
        y: 0,
        w: 200,
        h: 100,
        componentRef: "c1",
        overrides: { label: "Yo" },
      },
    ],
    children: { c1: ["t1"] },
    roots: ["c1", "i1"],
  };
  const res = await cdp.evalJs<{
    components: { name: string; filePath: string; written: boolean }[];
    report: unknown[];
  }>(
    `fetch(${JSON.stringify(api)} + "/api/fig/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(${JSON.stringify(compIr)}) }).then(r => r.json())`,
  );
  const comp = res.components[0];
  check("component generated+written", Boolean(comp?.written), JSON.stringify(res.components));
  if (comp?.written) {
    const file = join(ctx.projectDir, comp.filePath);
    check("imported file exists in temp project", existsSync(file));
    const code = readFileSync(file, "utf8");
    let parses = true;
    try {
      babelParse(code, { sourceType: "module", plugins: ["typescript", "jsx"] });
    } catch {
      parses = false;
    }
    check("imported component parses", parses);
    check("imported prop wired", code.includes("label?: string | number | boolean"));
  }
  void ir;
}
