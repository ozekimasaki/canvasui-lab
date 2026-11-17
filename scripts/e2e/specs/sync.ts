import type { Ctx } from "../run";
import { sleep } from "../cdp";
import { btn, createFrame, fresh } from "./helpers";

export async function run(ctx: Ctx): Promise<void> {
  const remote = process.env.CUL_E2E_REMOTE;
  if (!remote) {
    ctx.check("sync (skipped: CUL_E2E_REMOTE unset)", true);
    return;
  }
  const { cdp, check } = ctx;
  await fresh(ctx);
  await createFrame(ctx, { x: 500, y: 300 }, { x: 700, y: 450 });
  await btn(ctx, "同期");
  await sleep(1500);
  check(
    "sync toggle on",
    await cdp.evalJs(
      `document.querySelector('button[title="同期"]')?.getAttribute('aria-pressed') === "true"`,
    ),
  );
  const before = (await (await fetch(remote + "/api/sync?docId=main")).json()) as {
    layout: { version: number } | null;
  };
  await createFrame(ctx, { x: 800, y: 300 }, { x: 950, y: 420 });
  await sleep(2500);
  const after = (await (await fetch(remote + "/api/sync?docId=main")).json()) as {
    layout: { version: number; doc: { nodes: Record<string, unknown> } } | null;
    presence: unknown[];
  };
  check(
    "layout pushed to remote",
    Boolean(after.layout && after.layout.version > (before.layout?.version ?? 0)),
    JSON.stringify({ before: before.layout?.version, after: after.layout?.version }),
  );
  check(
    "remote has e2e nodes",
    Boolean(after.layout && Object.keys(after.layout.doc.nodes).length >= 2),
  );
  await btn(ctx, "同期");
  await sleep(500);
}
