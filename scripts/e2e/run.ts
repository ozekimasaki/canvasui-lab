import { spawn, execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { Cdp, sleep } from "./cdp";
import * as documentSpec from "./specs/document";
import * as gesturesSpec from "./specs/gestures";
import * as panelsSpec from "./specs/panels";
import * as catalogSpec from "./specs/catalog";
import * as layoutSpec from "./specs/layout";
import * as figSpec from "./specs/fig";
import * as syncSpec from "./specs/sync";

export interface Check {
  name: string;
  ok: boolean;
  extra?: string;
}

export interface Ctx {
  cdp: Cdp;
  checks: Check[];
  check: (name: string, ok: boolean, extra?: string) => void;
  api: () => Promise<string>;
  projectDir: string;
  artifactsDir: string;
  failShot: (name: string) => Promise<void>;
}

const root = process.cwd();

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => resolve(port));
    });
  });
}

async function main() {
  if (!process.argv.includes("--skip-build")) {
    execFileSync(join(root, "node_modules/.bin/electron-vite"), ["build"], { stdio: "inherit" });
  }
  const dataDir = mkdtempSync(join(tmpdir(), "cul-e2e-data-"));
  const projectDir = mkdtempSync(join(tmpdir(), "cul-e2e-proj-"));
  execFileSync("git", ["init", "-q"], { cwd: projectDir });
  execFileSync("git", ["config", "user.email", "e2e@canvasui.test"], { cwd: projectDir });
  execFileSync("git", ["config", "user.name", "CanvasUI E2E"], { cwd: projectDir });
  cpSync(join(root, "src/components"), join(projectDir, "src/components"), { recursive: true });
  cpSync(join(root, "db/migrations"), join(projectDir, "db/migrations"), { recursive: true });
  const artifactsDir = join(root, "scripts/e2e/artifacts");
  mkdirSync(artifactsDir, { recursive: true });
  const port = await freePort();
  const child = spawn(join(root, "node_modules/.bin/electron"), [join(root, "out/main/main.js")], {
    env: {
      ...process.env,
      CUL_DEBUG_PORT: String(port),
      CUL_PROJECT: projectDir,
      CUL_DATA_DIR: dataDir,
      CUL_REMOTE_API: process.env.CUL_E2E_REMOTE ?? "",
    },
    stdio: "ignore",
  });
  const checks: Check[] = [];
  let cdp: Cdp | null = null;
  try {
    let page: unknown = null;
    for (let i = 0; i < 60; i++) {
      try {
        const list = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()) as {
          type: string;
        }[];
        page = list.find((x) => x.type === "page");
        if (page) break;
      } catch {
        // not up yet
      }
      await sleep(500);
    }
    if (!page) throw new Error("electron did not expose CDP");
    cdp = await Cdp.connect(port);
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1600,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await cdp.send("Runtime.enable", {});
    cdp.consoleSink = (line) => {
      if (line.includes("[dbg]") || line.startsWith("error")) console.log(line);
    };
    const ctx: Ctx = {
      cdp,
      checks,
      check: (name, ok, extra) => checks.push({ name, ok, extra }),
      api: () => cdp!.evalJs<string>(`window.__CUL_API__ ?? ""`),
      projectDir,
      artifactsDir,
      failShot: async (name) => {
        try {
          await cdp!.screenshot(join(artifactsDir, name.replace(/[^a-z0-9]+/gi, "-") + ".png"));
        } catch {
          // best effort
        }
      },
    };
    const specs: [string, { run: (ctx: Ctx) => Promise<void> }][] = [
      ["document", documentSpec],
      ["gestures", gesturesSpec],
      ["panels", panelsSpec],
      ["catalog", catalogSpec],
      ["layout", layoutSpec],
      ["fig", figSpec],
      ["sync", syncSpec],
    ];
    const only = (process.argv.find((a) => a.startsWith("--only=")) ?? "")
      .slice(7)
      .split(",")
      .filter(Boolean);
    for (const [name, spec] of specs) {
      if (only.length && !only.includes(name)) continue;
      const before = checks.length;
      try {
        await spec.run(ctx);
      } catch (error) {
        checks.push({
          name: `${name}: crashed`,
          ok: false,
          extra: error instanceof Error ? error.message : String(error),
        });
        await ctx.failShot(name + "-crash");
      }
      const failed = checks.slice(before).filter((c) => !c.ok);
      for (const f of failed) await ctx.failShot(f.name);
      console.log(
        `[${name}] ${checks.slice(before).filter((c) => c.ok).length}/${checks.length - before} pass`,
      );
    }
  } catch (error) {
    checks.push({
      name: "runner",
      ok: false,
      extra: error instanceof Error ? error.message : String(error),
    });
  } finally {
    cdp?.close();
    child.kill();
    rmSync(dataDir, { recursive: true, force: true });
    rmSync(projectDir, { recursive: true, force: true });
  }
  const fails = checks.filter((c) => !c.ok);
  console.log("\n==== E2E RESULTS ====");
  for (const c of checks)
    console.log(`${c.ok ? "PASS" : "FAIL"} ${c.name}${c.extra ? " | " + c.extra : ""}`);
  console.log(`SUMMARY: ${checks.length - fails.length}/${checks.length} pass`);
  process.exit(fails.length ? 1 : 0);
}

void main();
