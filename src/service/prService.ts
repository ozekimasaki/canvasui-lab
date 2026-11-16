import { z } from "zod";
import type { ValidatedASTPatch, ValidatedPRRequest } from "../domain/brands";
import type { GithubSourceRepo } from "../repository/githubRepo";
import type { McpRepo } from "../repository/mcpRepo";

const patchSchema = z.object({
  filePath: z.string(),
  baseHash: z.string(),
  afterHash: z.string(),
  edits: z.array(z.object({ start: z.number(), end: z.number(), replacement: z.string() })).min(1),
});

const prSchema = z.object({
  branch: z.string().regex(/^canvasui\/[a-z0-9-]+$/),
  title: z.string().min(1).max(200),
  body: z.string().max(8000).default(""),
  patches: z.array(patchSchema).min(1).max(20),
});

export function createPrService(deps: { github: GithubSourceRepo; patches: McpRepo }) {
  return {
    async open(input: unknown) {
      const parsed = prSchema.parse(input);
      const patches = parsed.patches.map((patch) => patch as unknown as ValidatedASTPatch);
      const request = { ...parsed, patches } as unknown as ValidatedPRRequest;
      const { url, branch } = await deps.github.openPR(request);
      for (const patch of patches) {
        await deps.patches.recordPatch(patch, "ai", url);
      }
      return { url, branch };
    },
  };
}

export type PrService = ReturnType<typeof createPrService>;
