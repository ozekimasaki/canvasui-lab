import type { SourceEdit } from "../domain/brands";

export interface SourceFileView {
  filePath: string;
  content: string;
  hash: string;
}

export interface ProposedPatch {
  patch: { filePath: string; baseHash: string; afterHash: string; edits: SourceEdit[] };
  preview: string;
}

async function post(body: unknown): Promise<unknown> {
  const res = await fetch("/api/source", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json();
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String(data.error)
        : `source request failed: ${res.status}`;
    throw new Error(message);
  }
  return data;
}

export async function readSource(filePath: string): Promise<SourceFileView> {
  const res = await fetch(`/api/source?path=${encodeURIComponent(filePath)}`);
  const data: unknown = await res.json();
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String(data.error)
        : `read failed: ${res.status}`;
    throw new Error(message);
  }
  return data as SourceFileView;
}

export async function proposeSource(payload: {
  filePath: string;
  baseHash?: string;
  content?: string;
  edits?: SourceEdit[];
  anchor?: {
    kind: string;
    component?: string;
    element?: string;
    name?: string;
    value?: string | number | boolean;
  };
}): Promise<ProposedPatch> {
  return (await post({ action: "propose", ...payload })) as ProposedPatch;
}

export async function applySource(
  patch: ProposedPatch["patch"],
  author: "gui" | "ai" | "mcp",
): Promise<{ afterHash: string; filePath: string }> {
  return (await post({ action: "apply", ...patch, author })) as {
    afterHash: string;
    filePath: string;
  };
}
