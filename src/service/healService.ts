import { z } from "zod";
import type { AiPort } from "../ports";
import type { SourceService } from "./sourceService";

const healSchema = z.object({
  filePath: z.string().min(1),
  goal: z.string().min(1),
  image: z.string().optional(),
  component: z.string().optional(),
});

const HEAL_PROMPT = `You are a UI self-healing engine. You receive a screenshot of a rendered React component (or its source) and a goal. Identify concrete visual/code problems and propose minimal JSX attribute fixes. Respond ONLY with JSON (no prose, no fences): {"issues":[{"description":string,"severity":"info"|"warning"|"error","fix":{"kind":"jsx-attribute","component":string,"name":string,"value":string|number|boolean}|null}]}. Only propose fixes you are confident about; use null fix when unsure. Maximum 5 issues.`;

function extractText(result: unknown): string {
  if (typeof result === "object" && result !== null && "response" in result) {
    const response = (result as { response: unknown }).response;
    return typeof response === "string" ? response : JSON.stringify(response);
  }
  return "";
}

function parseIssues(text: string): {
  description: string;
  severity: string;
  fix: { kind: string; component?: string; name: string; value: string | number | boolean } | null;
}[] {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  if (start < 0) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(start)) as { issues?: unknown[] };
    return Array.isArray(parsed.issues) ? (parsed.issues as never[]) : [];
  } catch {
    return [];
  }
}

export function createHealService(deps: { ai: AiPort; source: SourceService }) {
  return {
    async run(input: unknown) {
      const parsed = healSchema.parse(input);
      let issues: ReturnType<typeof parseIssues> = [];
      if (parsed.image) {
        const match = /^data:[^;]+;base64,(.*)$/.exec(parsed.image);
        if (match) {
          const bytes = Uint8Array.from(atob(match[1]), (ch) => ch.charCodeAt(0));
          try {
            const result = await deps.ai.run("@cf/meta/llama-3.2-11b-vision-instruct", {
              image: Array.from(bytes),
              prompt: `${HEAL_PROMPT}
Goal: ${parsed.goal}
Component: ${parsed.component ?? "unknown"}`,
              max_tokens: 1024,
            });
            issues = parseIssues(extractText(result));
          } catch {
            issues = [];
          }
        }
      }
      if (issues.length === 0) {
        try {
          const file = await deps.source.read(parsed.filePath);
          const result = await deps.ai.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
            messages: [
              { role: "system", content: HEAL_PROMPT },
              {
                role: "user",
                content: JSON.stringify({
                  goal: parsed.goal,
                  component: parsed.component,
                  source: file.content.slice(0, 12000),
                }),
              },
            ],
            max_tokens: 1024,
          });
          issues = parseIssues(extractText(result));
        } catch {
          issues = [];
        }
      }
      const patches: { patch: unknown; preview: string; description: string }[] = [];
      for (const issue of issues) {
        if (!issue.fix || issue.fix.kind !== "jsx-attribute" || !issue.fix.name) continue;
        try {
          const proposed = await deps.source.propose({
            filePath: parsed.filePath,
            anchor: {
              kind: "jsx-attribute",
              component: issue.fix.component ?? parsed.component,
              name: issue.fix.name,
              value: issue.fix.value,
            },
          });
          patches.push({
            patch: proposed.patch,
            preview: proposed.preview,
            description: issue.description,
          });
        } catch {
          // anchor not resolvable: keep the issue as advisory only
        }
      }
      return { issues, patches };
    },
  };
}

export type HealService = ReturnType<typeof createHealService>;
