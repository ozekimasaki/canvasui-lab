import { z } from "zod";
import type { BridgeService } from "./bridgeService";
import type { SourceService } from "./sourceService";
import { ServiceError } from "./errors";

export interface McpToolContext {
  matrix: { list: () => Promise<unknown> };
  snapshots: {
    baselines: () => Promise<unknown>;
    pngByKey: (key: string) => Promise<Uint8Array | null>;
  };
  marks: {
    list: (cellKey?: string) => Promise<unknown>;
    create: (input: unknown) => Promise<unknown>;
  };
  source: SourceService;
  bridge: BridgeService;
  pr: { open: (input: unknown) => Promise<{ url: string; branch: string }> } | null;
  heal: { run: (input: unknown) => Promise<unknown> };
}

interface Tool {
  name: string;
  description: string;
  schema: z.ZodType;
  run: (args: never, ctx: McpToolContext) => Promise<unknown>;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

const empty = z.object({});

export function createMcpService(ctx: McpToolContext) {
  const tools: Tool[] = [
    {
      name: "canvas.cells",
      description: "List the component matrix cells (componentId, axis values, world rect).",
      schema: empty,
      run: async (_args, c) => c.matrix.list(),
    },
    {
      name: "canvas.describe",
      description: "Latest Agent View JSON tree published by the open canvas (live DOM structure).",
      schema: empty,
      run: async (_args, c) =>
        (await c.bridge.getState("canvas")) ?? { error: "no canvas connected" },
    },
    {
      name: "canvas.snapshot",
      description: "Capture a matrix cell from GPU memory and return its PNG (stored in R2).",
      schema: z.object({ cellKey: z.string(), scale: z.number().min(0.5).max(4).default(2) }),
      run: async (args: { cellKey: string; scale: number }, c) => {
        const result = await c.bridge.command<{ r2Key: string }>("snapshot", args);
        const png = await c.snapshots.pngByKey(result.r2Key);
        if (!png) throw new ServiceError("snapshot object missing", 502);
        return { image: { data: bytesToBase64(png), mimeType: "image/png" }, r2Key: result.r2Key };
      },
    },
    {
      name: "vrt.run",
      description:
        "Run GPU visual regression against approved baselines; returns changed cell keys.",
      schema: z.object({ cellKeys: z.array(z.string()).optional() }),
      run: async (args: { cellKeys?: string[] }, c) => c.bridge.command("vrt", args),
    },
    {
      name: "vrt.baselines",
      description: "List approved baseline snapshots.",
      schema: empty,
      run: async (_args, c) => c.snapshots.baselines(),
    },
    {
      name: "audit.run",
      description: "Run the Workers AI UI audit on up to 20 cells; pins marks on the canvas.",
      schema: z.object({ cellKeys: z.array(z.string()).optional() }),
      run: async (args: { cellKeys?: string[] }, c) => c.bridge.command("audit", args),
    },
    {
      name: "marks.list",
      description: "List canvas marks (AI and human).",
      schema: z.object({ cellKey: z.string().optional() }),
      run: async (args: { cellKey?: string }, c) => c.marks.list(args.cellKey),
    },
    {
      name: "marks.add",
      description: "Pin a mark on a matrix cell.",
      schema: z.object({
        cellKey: z.string(),
        text: z.string().min(1).max(2000),
        severity: z.enum(["info", "warning", "error"]).default("info"),
      }),
      run: async (
        args: { cellKey: string; text: string; severity: "info" | "warning" | "error" },
        c,
      ) =>
        c.marks.create({
          marks: [{ ...args, kind: "pin", author: "ai", targetElementId: null, runId: null }],
        }),
    },
    {
      name: "source.read",
      description:
        "Read a component source file (allowlisted src/components/**/*.tsx) with its hash.",
      schema: z.object({ filePath: z.string() }),
      run: async (args: { filePath: string }, c) => c.source.read(args.filePath),
    },
    {
      name: "source.propose",
      description:
        "Dry-run an AST-safe patch: propose full content, explicit edits, or a JSX anchor; returns validated patch + preview.",
      schema: z.object({
        filePath: z.string(),
        baseHash: z.string().optional(),
        content: z.string().optional(),
        edits: z
          .array(z.object({ start: z.number(), end: z.number(), replacement: z.string() }))
          .optional(),
        anchor: z.record(z.string(), z.unknown()).optional(),
      }),
      run: async (args: Record<string, unknown>, c) => c.source.propose(args),
    },
    {
      name: "source.apply",
      description:
        "Apply a validated AST patch (write-back to local files in dev, GitHub branch commit in production).",
      schema: z.object({
        filePath: z.string(),
        baseHash: z.string(),
        afterHash: z.string(),
        edits: z
          .array(z.object({ start: z.number(), end: z.number(), replacement: z.string() }))
          .min(1),
      }),
      run: async (args: Record<string, unknown>, c) => c.source.apply({ ...args, author: "mcp" }),
    },
    {
      name: "pr.open",
      description: "Commit validated patches to a new GitHub branch and open a pull request.",
      schema: z.object({
        branch: z.string().regex(/^canvasui\/[a-z0-9-]+$/),
        title: z.string().min(1).max(200),
        body: z.string().max(8000).default(""),
        patches: z
          .array(
            z.object({
              filePath: z.string(),
              baseHash: z.string(),
              afterHash: z.string(),
              edits: z
                .array(z.object({ start: z.number(), end: z.number(), replacement: z.string() }))
                .min(1),
            }),
          )
          .min(1),
      }),
      run: async (args: Record<string, unknown>, c) => {
        if (!c.pr) throw new ServiceError("GitHub write-back is not configured", 503);
        return c.pr.open(args);
      },
    },
    {
      name: "heal.run",
      description:
        "Evaluate a component screenshot (or source) against a goal and propose AST-anchored fixes. Returns issues and unapplied patches.",
      schema: z.object({
        filePath: z.string(),
        goal: z.string(),
        image: z.string().optional(),
        component: z.string().optional(),
      }),
      run: async (
        args: { filePath: string; goal: string; image?: string; component?: string },
        c,
      ) => c.heal.run(args),
    },
  ];

  return {
    listTools() {
      return tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: z.toJSONSchema(tool.schema),
      }));
    },
    async callTool(name: string, args: unknown) {
      const tool = tools.find((candidate) => candidate.name === name);
      if (!tool) throw new ServiceError(`unknown tool: ${name}`, 404);
      const parsed = tool.schema.parse(args ?? {});
      const result = await tool.run(parsed as never, ctx);
      if (result && typeof result === "object" && "image" in result) {
        const image = (result as { image: { data: string; mimeType: string } }).image;
        return { content: [{ type: "image", data: image.data, mimeType: image.mimeType }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(result ?? null) }] };
    },
  };
}

export type McpService = ReturnType<typeof createMcpService>;
