import type { AiPort } from "../ports";
import { z } from "zod";
import type { ValidatedAuditMark } from "../domain/brands";
import type { MarkRepo } from "../repository/markRepo";
import { ServiceError } from "./errors";

const cellSchema = z.object({
  cellKey: z.string().min(1).max(300),
  componentName: z.string().max(200).optional(),
  describe: z.unknown(),
  diff: z
    .object({ changed: z.boolean(), diffRatio: z.number(), bounds: z.unknown().nullable() })
    .optional(),
});

const requestSchema = z.object({ cells: z.array(cellSchema).min(1).max(20) });

const aiMarkSchema = z.object({
  cellKey: z.string().min(1),
  targetElementId: z.string().nullable().optional(),
  kind: z.enum(["pin", "note"]),
  text: z.string().min(1).max(1000),
  severity: z.enum(["info", "warning", "error"]),
});

const SYSTEM_PROMPT = `You are a UI auditor for a design system matrix. You receive a JSON tree of live UI cells (from an agent view) plus visual-regression diff info. Identify concrete problems: broken layout, clipped or overflowing text, missing states, contrast issues, inconsistency with design tokens, or regressions indicated by diffs. Respond ONLY with a JSON array (no prose, no code fences) of objects: {"cellKey": string, "targetElementId": string|null, "kind": "pin"|"note", "text": string (one actionable sentence), "severity": "info"|"warning"|"error"}. Use element ids from the tree when pointing at a specific element. Return [] when nothing is wrong. Maximum 10 marks.`;

export function createAuditService(deps: { marks: MarkRepo; ai: AiPort }) {
  return {
    async audit(input: unknown) {
      const { cells } = requestSchema.parse(input);
      const userPrompt = JSON.stringify({ cells });
      let responseText: string;
      try {
        const result = await deps.ai.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 2048,
        });
        responseText =
          typeof result === "object" && result !== null && "response" in result
            ? typeof result.response === "string"
              ? result.response
              : JSON.stringify(result.response)
            : "";
      } catch (error) {
        if (error instanceof Error && error.name === "UsageLimit") {
          throw new ServiceError("Workers AI usage limit reached. Try again later.", 429);
        }
        throw error;
      }
      const marks = parseAiMarks(responseText);
      const runId = crypto.randomUUID();
      const validated = marks.map(
        (m) =>
          ({
            cellKey: m.cellKey,
            targetElementId: m.targetElementId ?? null,
            kind: m.kind,
            text: m.text,
            severity: m.severity,
            author: "ai",
            runId,
          }) as ValidatedAuditMark,
      );
      if (validated.length > 0) await deps.marks.saveMany(validated);
      return { runId, marks: validated };
    },
  };
}

function parseAiMarks(text: string): z.infer<typeof aiMarkSchema>[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new ServiceError("AI response did not contain a JSON array", 502);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new ServiceError("AI response was not valid JSON", 502);
  }
  return z.array(aiMarkSchema).max(10).parse(raw);
}

export type AuditService = ReturnType<typeof createAuditService>;
