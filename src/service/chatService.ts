import { z } from "zod";
import type { AiPort } from "../ports";

const chatSchema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).min(1),
  context: z.unknown().optional(),
});

const SYSTEM = `You are the CanvasUI Lab assistant inside a DOM-native visual IDE. Answer concisely in the user's language (default Japanese). You can edit React component sources through AST-anchored patches. When a source change is requested, append a fenced json block: {"actions":[{"tool":"source.propose","args":{"filePath":string,"anchor":{"kind":"jsx-attribute","component":string,"name":string,"value":string|number|boolean}}}]}. Only use component names and file paths present in the provided context. Never invent files.`;

export function createChatService(deps: { ai: AiPort }) {
  return {
    async chat(input: unknown) {
      const parsed = chatSchema.parse(input);
      const result = await deps.ai.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Context: ${JSON.stringify(parsed.context ?? {})}` },
          ...parsed.messages,
        ],
        max_tokens: 1500,
      });
      const response =
        typeof result === "object" && result !== null && "response" in result
          ? (result as { response: unknown }).response
          : undefined;
      const text =
        typeof response === "string"
          ? response
          : response === undefined
            ? ""
            : JSON.stringify(response);
      let reply = text;
      let actions: { tool: string; args: Record<string, unknown> }[] = [];
      const fence = /```json\s*([\s\S]*?)```/.exec(text);
      if (fence) {
        reply = text.replace(fence[0], "").trim();
        try {
          const parsedBlock = JSON.parse(fence[1]) as {
            actions?: { tool: string; args: Record<string, unknown> }[];
          };
          actions = Array.isArray(parsedBlock.actions) ? parsedBlock.actions : [];
        } catch {
          actions = [];
        }
      }
      return { reply, actions };
    },
  };
}

export type ChatService = ReturnType<typeof createChatService>;
