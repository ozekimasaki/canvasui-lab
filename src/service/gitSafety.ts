import { execFileSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface UndoEntry {
  id: string;
  ref: string;
  files: string[];
  created?: string[];
  createdAt: string;
}

interface TreeEntry {
  mode: string;
  type: string;
  hash: string;
  path: string;
}

export function createGitSafety(root: string) {
  const git = (args: string[], input?: string) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", input });

  const buildTree = (entries: TreeEntry[]): string => {
    const lines: string[] = [];
    const dirs = new Map<string, TreeEntry[]>();
    for (const entry of entries) {
      const slash = entry.path.indexOf("/");
      if (slash < 0) {
        lines.push(`${entry.mode} ${entry.type} ${entry.hash}\t${entry.path}`);
      } else {
        const dir = entry.path.slice(0, slash);
        const rest = entry.path.slice(slash + 1);
        const list = dirs.get(dir) ?? [];
        list.push({ ...entry, path: rest });
        dirs.set(dir, list);
      }
    }
    for (const [dir, list] of dirs) {
      lines.push(`040000 tree ${buildTree(list)}\t${dir}`);
    }
    return git(["mktree"], lines.join("\n")).trim();
  };

  return {
    snapshot(files: string[]): UndoEntry | null {
      try {
        git(["rev-parse", "--git-dir"]);
        const entries: TreeEntry[] = [];
        const created: string[] = [];
        for (const file of files) {
          if (!existsSync(join(root, file))) {
            created.push(file);
            continue;
          }
          const blob = git(["hash-object", "-w", "--", file]).trim();
          entries.push({ mode: "100644", type: "blob", hash: blob, path: file });
        }
        const tree = buildTree(entries);
        const commit = git(["commit-tree", tree, "-m", "canvasui undo snapshot"]).trim();
        const ref = `refs/canvasui/undo/${Date.now()}`;
        git(["update-ref", ref, commit]);
        return {
          id: crypto.randomUUID(),
          ref,
          files,
          created,
          createdAt: new Date().toISOString(),
        };
      } catch {
        return null;
      }
    },
    restore(entry: UndoEntry) {
      for (const file of entry.files) {
        if (entry.created?.includes(file)) rmSync(join(root, file), { force: true });
        else writeFileSync(join(root, file), git(["show", `${entry.ref}:${file}`]));
      }
    },
  };
}
