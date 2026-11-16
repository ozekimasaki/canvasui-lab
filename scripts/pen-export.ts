import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const API = process.env.CANVASUI_API ?? "http://localhost:5173";

const version = spawnSync("pen", ["version"], { encoding: "utf8" });
if (version.error || version.status !== 0) {
  console.error("pen CLI not found. Install and login first:");
  console.error("  npm install -g @pen.dev/cli");
  console.error("  pen login");
  process.exit(1);
}

const designDir = join(process.cwd(), "design");
const files = readdirSync(designDir).filter((f) => f.endsWith(".pen"));
if (files.length === 0) {
  console.error("No .pen files in design/");
  process.exit(1);
}

const outDir = mkdtempSync(join(tmpdir(), "canvasui-pen-"));
let failures = 0;

for (const file of files) {
  const name = basename(file, ".pen");
  const input = join(designDir, file);
  const output = join(outDir, `${name}.png`);
  console.log(`Exporting ${file} …`);
  spawnSync(
    "pen",
    ["--in", input, "--export", output, "--export-scale", "2", "--export-type", "png"],
    {
      stdio: "inherit",
    },
  );
  // pen can exit 0 on export failure — the file's existence is the source of truth.
  if (!existsSync(output)) {
    console.error(`  FAILED: ${output} was not created (check pen login / file validity)`);
    failures++;
    continue;
  }
  const bytes = readFileSync(output);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const form = new FormData();
  form.set("componentId", `pen:${name}`);
  form.set("cellKey", `pen:${name}:document`);
  form.set("kind", "design");
  form.set("source", "pen");
  form.set("width", String(width));
  form.set("height", String(height));
  form.set("scale", "2");
  form.set("png", new Blob([new Uint8Array(bytes)], { type: "image/png" }), `${name}.png`);
  const res = await fetch(`${API}/api/snapshots`, { method: "POST", body: form });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    console.error(`  FAILED to import: ${data?.error ?? res.status}`);
    failures++;
    continue;
  }
  console.log(`  OK: ${width}x${height} → design/pen/${name}`);
}

process.exit(failures > 0 ? 1 : 0);
