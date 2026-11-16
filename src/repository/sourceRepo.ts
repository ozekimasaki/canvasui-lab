import type { FactoryGate, ValidatedASTPatch } from "../domain/brands";
import { ServiceError } from "../service/errors";

export interface SourceRepo {
  read(filePath: string): Promise<{ content: string } | null>;
  write(patch: ValidatedASTPatch): Promise<{ afterHash: string }>;
  create?(filePath: string, content: string): Promise<void>;
}

export function createOfflineSourceRepo(gate: FactoryGate): SourceRepo {
  if (!gate) throw new Error("FactoryGate required");
  const disabled = () => {
    throw new ServiceError("write-back is disabled (WRITEBACK_MODE=off)", 503);
  };
  return { read: disabled, write: disabled };
}

export function createLocalSourceRepo(
  gate: FactoryGate,
  opts: { baseUrl: string; token: string },
): SourceRepo {
  if (!gate) throw new Error("FactoryGate required");
  const headers = { "x-canvasui-token": opts.token, "content-type": "application/json" };
  return {
    async read(filePath) {
      const res = await fetch(
        `${opts.baseUrl}/__canvasui/source?path=${encodeURIComponent(filePath)}`,
        {
          headers,
        },
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new ServiceError(`local source read failed: ${res.status}`, 502);
      return (await res.json()) as { content: string };
    },
    async write(patch) {
      const res = await fetch(`${opts.baseUrl}/__canvasui/source`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          filePath: patch.filePath,
          baseHash: patch.baseHash,
          edits: patch.edits,
        }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (res.status === 409)
        throw new ServiceError("write-back conflict: file changed on disk", 409);
      if (!res.ok) {
        const message =
          data && typeof data === "object" && "error" in data
            ? String(data.error)
            : `write failed: ${res.status}`;
        throw new ServiceError(message, 502);
      }
      return data as { afterHash: string };
    },
  };
}
