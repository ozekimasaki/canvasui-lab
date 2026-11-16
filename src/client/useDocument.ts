import { useCallback, useEffect, useRef, useState } from "react";
import { emptyDocument, reduce, type DocAction, type Document } from "../domain/document";
import { fetchDocument, saveDocument } from "./documentClient";

export const DOC_ID = "main";

export function useDocument() {
  const [doc, setDoc] = useState<Document>(() => emptyDocument(DOC_ID, "Untitled"));
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const past = useRef<Document[]>([]);
  const future = useRef<Document[]>([]);
  const [, bump] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchDocument(DOC_ID)
      .then((loaded) => {
        setDoc(loaded);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  const scheduleSave = useCallback((next: Document) => {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDocument(next)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("saved"));
    }, 400);
  }, []);

  const dispatch = useCallback(
    (action: DocAction, opts?: { history?: boolean }) => {
      setDoc((current) => {
        if (opts?.history !== false) {
          past.current.push(current);
          if (past.current.length > 100) past.current.shift();
          future.current = [];
        }
        const next = reduce(current, action);
        scheduleSave(next);
        return next;
      });
      bump((n) => n + 1);
    },
    [scheduleSave],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return false;
    setDoc((current) => {
      future.current.push(current);
      scheduleSave(prev);
      return prev;
    });
    bump((n) => n + 1);
    return true;
  }, [scheduleSave]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return false;
    setDoc((current) => {
      past.current.push(current);
      scheduleSave(next);
      return next;
    });
    bump((n) => n + 1);
    return true;
  }, [scheduleSave]);

  const rename = useCallback(
    (name: string) => {
      setDoc((current) => {
        const next = { ...current, name };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  return {
    doc,
    ready,
    dispatch,
    undo,
    redo,
    rename,
    saveState,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
