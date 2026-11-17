import type { Ctx } from "../run";
import { sleep } from "../cdp";
import { fresh } from "./helpers";

const EN_CHROME = [
  "Refresh",
  "Clear AI",
  "Zoom in",
  "Zoom out",
  "Close chat",
  "Send",
  "Apply to source",
  "Loading editor",
];
const JA_CHROME = [
  "レイヤー",
  "アセット",
  "デザイン",
  "コード",
  "変数",
  "マーク",
  "更新",
  "送信",
  "ソースに適用",
];

export async function run(ctx: Ctx): Promise<void> {
  const { cdp, check } = ctx;
  await cdp.evalJs(`localStorage.setItem("cul_lang", "ja")`);
  await fresh(ctx);
  await sleep(600);
  const jaBody = await cdp.evalJs<string>(`document.body.textContent`);
  check(
    "ja: no english chrome",
    EN_CHROME.every((w) => !jaBody.includes(w)),
    JSON.stringify(EN_CHROME.filter((w) => jaBody.includes(w))),
  );
  await cdp.evalJs(
    `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'English')?.click()`,
  );
  await sleep(600);
  const enBody = await cdp.evalJs<string>(`document.body.textContent`);
  check(
    "en: no japanese chrome",
    JA_CHROME.every((w) => !enBody.includes(w)),
    JSON.stringify(JA_CHROME.filter((w) => enBody.includes(w))),
  );
  check("en: lang attr", (await cdp.evalJs<string>(`document.documentElement.lang`)) === "en");
  await cdp.evalJs(
    `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '日本語')?.click()`,
  );
  await sleep(600);
  check("ja: toggle back", (await cdp.evalJs<string>(`document.documentElement.lang`)) === "ja");
}
