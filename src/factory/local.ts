import { desc } from "drizzle-orm";
import { undoLog } from "@schema";
import { createLocalPorts, type LocalOpts } from "../adapters/local";
import { createFsSourceRepo } from "../adapters/fsSource";
import { createGitSafety } from "../service/gitSafety";
import type { DbPort } from "../ports";
import { createServices, type Services } from "./index";

export const undoStack: { id: string; ref: string; files: string[]; createdAt: string }[] = [];

export function createSafeSourceRepo(
  gate: Parameters<typeof createFsSourceRepo>[0],
  projectRoot: string,
  db: DbPort,
) {
  const safety = createGitSafety(projectRoot);
  return createFsSourceRepo(gate, projectRoot, (files) => {
    const entry = safety.snapshot(files);
    if (entry) {
      undoStack.push(entry);
      void db
        .insert(undoLog)
        .values({
          id: entry.id,
          ref: entry.ref,
          files: JSON.stringify({ files: entry.files, created: entry.created ?? [] }),
          createdAt: entry.createdAt,
        })
        .catch(() => undefined);
    }
  });
}

export function createLocalServices(opts: LocalOpts & { projectRoot: string }): Services {
  const ports = createLocalPorts(opts);
  return createServices(ports, {
    writeback: "local",
    makeSourceRepo: (gate) => createSafeSourceRepo(gate, opts.projectRoot, ports.db),
  });
}

export async function undoLast(root: string, db?: DbPort): Promise<boolean> {
  let entry = undoStack.pop();
  if (!entry && db) {
    const rows = await db.select().from(undoLog).orderBy(desc(undoLog.createdAt)).limit(1);
    if (rows[0]) {
      entry = {
        id: rows[0].id,
        ref: rows[0].ref,
        files: JSON.parse(rows[0].files) as string[],
        createdAt: rows[0].createdAt,
      };
    }
  }
  if (!entry) return false;
  createGitSafety(root).restore(entry);
  return true;
}
