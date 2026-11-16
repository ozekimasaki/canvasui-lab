export function fetch(path: string, init?: RequestInit): Promise<Response> {
  const base = (window as unknown as { __CUL_API__?: string }).__CUL_API__ ?? "";
  return globalThis.fetch(base + path, init);
}
