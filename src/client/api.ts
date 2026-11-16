export function apiBase(): string {
  return (window as unknown as { __CUL_API__?: string }).__CUL_API__ ?? "";
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiBase() + path, init);
}

export function syncBase(): string {
  const native = (window as Window & { __CUL_NATIVE__?: { syncApi?: string } }).__CUL_NATIVE__;
  return native?.syncApi || apiBase();
}

export function syncFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(syncBase() + path, init);
}
