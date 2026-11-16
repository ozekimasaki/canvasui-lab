import type { FactoryGate, ValidatedASTPatch, ValidatedPRRequest } from "../domain/brands";
import { ServiceError } from "../service/errors";
import type { SourceRepo } from "./sourceRepo";

export interface GithubSourceRepo extends SourceRepo {
  openPR(request: ValidatedPRRequest): Promise<{ url: string; branch: string }>;
}

export function createGithubSourceRepo(
  gate: FactoryGate,
  opts: { token: string; repo: string },
): GithubSourceRepo {
  if (!gate) throw new Error("FactoryGate required");
  const api = async (
    path: string,
    init?: { method?: string; body?: string; headers?: Record<string, string> },
  ): Promise<Record<string, unknown>> => {
    const res = await fetch(`https://api.github.com/repos/${opts.repo}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${opts.token}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
        "user-agent": "canvasui-lab",
        ...init?.headers,
      },
    });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        data && typeof data === "object" && "message" in data
          ? String(data.message)
          : `GitHub ${res.status}`;
      throw new ServiceError(message, 502);
    }
    return (data ?? {}) as Record<string, unknown>;
  };

  const commitPatch = async (patch: ValidatedASTPatch, branch: string, message: string) => {
    const current = await api(`/contents/${patch.filePath}?ref=${encodeURIComponent(branch)}`);
    const content =
      typeof current.content === "string" ? atob(current.content.replace(/\n/g, "")) : "";
    const { sha256Hex } = await import("../domain/snapshot");
    const currentHash = await sha256Hex(new TextEncoder().encode(content));
    if (currentHash !== patch.baseHash) {
      throw new ServiceError("GitHub content diverged from patch baseHash", 409);
    }
    const { applyEdits } = await import("../domain/ast");
    const next = applyEdits(content, patch.edits);
    if (next === null) throw new ServiceError("patch does not apply to GitHub content", 409);
    await api(`/contents/${patch.filePath}`, {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: btoa(unescape(encodeURIComponent(next))),
        sha: typeof current.sha === "string" ? current.sha : undefined,
        branch,
      }),
    });
  };

  return {
    async read(filePath) {
      const data = await api(`/contents/${filePath}?ref=main`).catch(() => null);
      if (!data || typeof data.content !== "string") return null;
      return { content: decodeURIComponent(escape(atob(data.content.replace(/\n/g, "")))) };
    },
    async write(patch) {
      const branch = `canvasui/patch-${patch.afterHash.slice(0, 10)}`;
      const main = await api("/git/ref/heads/main");
      const object = main.object as { sha: string } | undefined;
      if (!object?.sha) throw new ServiceError("cannot resolve main ref", 502);
      await api("/git/refs", {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: object.sha }),
      }).catch(async (error) => {
        if (!(error instanceof ServiceError) || !error.message.includes("Reference already exists"))
          throw error;
      });
      await commitPatch(patch, branch, `canvasui: AST write-back ${patch.filePath}`);
      return { afterHash: patch.afterHash, branch };
    },
    async openPR(request) {
      const branch = request.branch;
      const main = await api("/git/ref/heads/main");
      const object = main.object as { sha: string } | undefined;
      if (!object?.sha) throw new ServiceError("cannot resolve main ref", 502);
      await api("/git/refs", {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: object.sha }),
      }).catch(async (error) => {
        if (!(error instanceof ServiceError) || !error.message.includes("Reference already exists"))
          throw error;
      });
      for (const patch of request.patches) {
        await commitPatch(patch, branch, `canvasui: ${request.title} (${patch.filePath})`);
      }
      const pr = await api("/pulls", {
        method: "POST",
        body: JSON.stringify({
          title: request.title,
          body: request.body,
          head: branch,
          base: "main",
        }),
      });
      return { url: typeof pr.html_url === "string" ? pr.html_url : "", branch };
    },
  };
}
