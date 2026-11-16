import type { Document } from "../domain/document";
import { apiFetch } from "./api";

export async function fetchDocument(id: string): Promise<Document> {
  const res = await apiFetch(`/api/document?id=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`document fetch failed: ${res.status}`);
  return (await res.json()) as Document;
}

export async function saveDocument(doc: Document): Promise<void> {
  const res = await apiFetch("/api/document", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(doc),
  });
  if (!res.ok) throw new Error(`document save failed: ${res.status}`);
}
