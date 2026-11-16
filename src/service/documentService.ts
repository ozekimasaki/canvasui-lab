import { z } from "zod";
import { emptyDocument, reduce, type DocAction, type Document } from "../domain/document";
import type { DocumentRepo } from "../repository/documentRepo";

const actionSchema = z.object({ type: z.string() }).passthrough();

export function createDocumentService(deps: { documents: DocumentRepo }) {
  return {
    async get(id: string): Promise<Document> {
      return (await deps.documents.get(id)) ?? emptyDocument(id, "Untitled");
    },
    async put(doc: Document): Promise<void> {
      await deps.documents.put(doc);
    },
    async list() {
      return deps.documents.list();
    },
    async apply(id: string, actions: unknown[]): Promise<Document> {
      let doc = await this.get(id);
      for (const action of actions) {
        doc = reduce(doc, actionSchema.parse(action) as DocAction);
      }
      await deps.documents.put(doc);
      return doc;
    },
  };
}

export type DocumentService = ReturnType<typeof createDocumentService>;
