import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { resolve, sep } from "node:path";
import { applyEdits, WRITEBACK_ALLOWLIST } from "../domain/ast";
import type { FactoryGate, ValidatedASTPatch } from "../domain/brands";
import type { SourceRepo } from "../repository/sourceRepo";
import { ServiceError } from "../service/errors";

const sha = (content: string) => createHash("sha256").update(content).digest("hex");

export function createFsSourceRepo(
  gate: FactoryGate,
  root: string,
  onBeforeWrite?: (files: string[]) => void,
): SourceRepo {
  if (!gate) throw new Error("FactoryGate required");
  const guard = (filePath: string) => {
    if (!WRITEBACK_ALLOWLIST.test(filePath) || filePath.includes("..")) {
      throw new ServiceError("filePath is outside the write-back allowlist");
    }
    const abs = resolve(root, filePath);
    if (!abs.startsWith(root + sep)) throw new ServiceError("path escapes project root");
    return abs;
  };
  return {
    read: async (filePath) => {
      const abs = guard(filePath);
      if (!existsSync(abs)) return null;
      return { content: readFileSync(abs, "utf8") };
    },
    write: async (patch: ValidatedASTPatch) => {
      const abs = guard(patch.filePath);
      const current = readFileSync(abs, "utf8");
      if (sha(current) !== patch.baseHash)
        throw new ServiceError("write-back conflict: file changed on disk", 409);
      onBeforeWrite?.([patch.filePath]);
      const next = applyEdits(current, patch.edits);
      if (next === null) throw new ServiceError("invalid edit ranges");
      writeFileSync(abs, next, "utf8");
      return { afterHash: sha(next) };
    },
    create: async (filePath, content) => {
      const abs = guard(filePath);
      if (existsSync(abs)) throw new ServiceError(`file already exists: ${filePath}`, 409);
      onBeforeWrite?.([filePath]);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content, "utf8");
    },
  };
}
