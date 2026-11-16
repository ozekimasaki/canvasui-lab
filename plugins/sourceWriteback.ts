import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { parse as babelParse } from "@babel/parser";
import type { Plugin } from "vite";
import { loadEnv } from "vite";
import { applyEdits, WRITEBACK_ALLOWLIST, type AstNode, type SourceEdit } from "../src/domain/ast";

const parseTsx = (content: string) => {
  const file = babelParse(content, {
    sourceType: "module",
    plugins: ["typescript", "jsx", "estree"],
  }) as unknown as { program?: unknown };
  return file.program ?? file;
};

function sha(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function sourceWriteback(): Plugin {
  let root = process.cwd();
  let token = "";
  return {
    name: "canvasui-source-writeback",
    configResolved(config) {
      root = config.root;
      const env = loadEnv(config.mode, root, "");
      token = env.CANVASUI_WRITEBACK_TOKEN ?? "";
    },
    configureServer(server) {
      server.middlewares.use("/__canvasui/source", (req, res) => {
        void (async () => {
          const send = (status: number, body: unknown) => {
            res.statusCode = status;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(body));
          };
          if (!token || req.headers["x-canvasui-token"] !== token) {
            send(401, { error: "write-back token required" });
            return;
          }
          const url = new URL(req.url ?? "/", "http://localhost");
          const rel = url.searchParams.get("path") ?? "";
          const guard = (filePath: string): string | null => {
            if (!WRITEBACK_ALLOWLIST.test(filePath) || filePath.includes(".."))
              return "path not allowlisted";
            const abs = resolve(root, filePath);
            if (!abs.startsWith(root + sep)) return "path escapes project root";
            return null;
          };
          try {
            if (req.method === "GET") {
              const bad = guard(rel);
              if (bad) return send(400, { error: bad });
              const content = await readFile(resolve(root, rel), "utf8").catch(() => null);
              if (content === null) return send(404, { error: "not found" });
              return send(200, { content });
            }
            if (req.method === "POST") {
              const chunks: Buffer[] = [];
              for await (const chunk of req) chunks.push(chunk as Buffer);
              const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
                filePath: string;
                baseHash: string;
                edits: SourceEdit[];
              };
              const bad = guard(body.filePath);
              if (bad) return send(400, { error: bad });
              const abs = resolve(root, body.filePath);
              const current = await readFile(abs, "utf8");
              if (sha(current) !== body.baseHash) return send(409, { error: "baseHash mismatch" });
              const next = applyEdits(current, body.edits);
              if (next === null) return send(400, { error: "invalid edit ranges" });
              try {
                parseTsx(next);
              } catch {
                return send(400, { error: "patched source does not parse" });
              }
              await writeFile(abs, next, "utf8");
              return send(200, { afterHash: sha(next) });
            }
            send(405, { error: "method not allowed" });
          } catch (error) {
            send(500, { error: error instanceof Error ? error.message : "write-back failed" });
          }
        })();
      });
    },
  };
}

export type { AstNode };
