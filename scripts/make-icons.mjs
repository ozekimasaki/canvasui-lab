import { Resvg } from "@resvg/resvg-js";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

if (process.platform !== "darwin") {
  console.error(
    "icons:build requires macOS (iconutil). Generated assets are committed; regenerate on a mac.",
  );
  process.exit(1);
}

const root = join(import.meta.dirname, "..");
const svg = readFileSync(join(root, "build/icon.svg"), "utf8");
const render = (px, source = svg) =>
  new Resvg(source, { fitTo: { mode: "width", value: px } }).render().asPng();

const written = [];
const put = (path, buf) => {
  writeFileSync(path, buf);
  written.push(`${path} (${statSync(path).size} bytes)`);
};

const iconset = join(root, "build/icon.iconset");
mkdirSync(iconset, { recursive: true });
for (const s of [16, 32, 128, 256, 512]) {
  put(join(iconset, `icon_${s}x${s}.png`), render(s));
  put(join(iconset, `icon_${s}x${s}@2x.png`), render(s * 2));
}

execFileSync("iconutil", ["-c", "icns", iconset, "-o", join(root, "build/icon.icns")]);
written.push(
  `${join(root, "build/icon.icns")} (${statSync(join(root, "build/icon.icns")).size} bytes)`,
);

put(join(root, "build/icon.png"), render(1024));

for (const dir of ["public", "electron/renderer/public"]) {
  const out = join(root, dir);
  mkdirSync(out, { recursive: true });
  copyFileSync(join(root, "build/icon.svg"), join(out, "favicon.svg"));
  put(join(out, "favicon-32.png"), render(32));
}
put(
  join(root, "public/apple-touch-icon.png"),
  render(180, svg.replace('viewBox="0 0 1024 1024"', 'viewBox="100 100 824 824"')),
);

for (const line of written) console.log(line);
