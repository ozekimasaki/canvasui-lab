import type * as monaco from "monaco-editor";
import { Code2, Save, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { applySource, proposeSource, readSource } from "./sourceClient";
import { useI18n } from "./i18n";
import { translateError } from "./errors";

export default function EditorPanel({
  filePath,
  onClose,
  onApplied,
}: {
  filePath: string;
  onClose: () => void;
  onApplied: (message: string) => void;
}) {
  const { t } = useI18n();
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [baseHash, setBaseHash] = useState("");
  const [status, setStatus] = useState(t("editor.loading"));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let disposed = false;
    let editor: monaco.editor.IStandaloneCodeEditor | null = null;
    void (async () => {
      const monacoNs = await import("monaco-editor");
      const [{ default: EditorWorker }, { default: TsWorker }] = await Promise.all([
        import("monaco-editor/editor/editor.worker?worker"),
        import("monaco-editor/language/typescript/ts.worker?worker"),
      ]);
      (self as unknown as { MonacoEnvironment?: unknown }).MonacoEnvironment = {
        getWorker(_workerId: string, label: string) {
          return label === "typescript" || label === "javascript"
            ? new TsWorker()
            : new EditorWorker();
        },
      };
      const { typescriptDefaults, JsxEmit, ScriptTarget, ModuleKind } =
        await import("monaco-editor/language/typescript/monaco.contribution");
      typescriptDefaults.setCompilerOptions({
        jsx: JsxEmit.ReactJSX,
        allowNonTsExtensions: true,
        target: ScriptTarget.ESNext,
        module: ModuleKind.ESNext,
      });
      const file = await readSource(filePath);
      if (disposed || !hostRef.current) return;
      setBaseHash(file.hash);
      const chrome = document.documentElement.getAttribute("data-chrome");
      const dark =
        chrome === "dark" ||
        (chrome === null && matchMedia("(prefers-color-scheme: dark)").matches);
      editor = monacoNs.editor.create(hostRef.current, {
        value: file.content,
        language: "typescript",
        theme: dark ? "vs-dark" : "vs",
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 12,
        scrollBeyondLastLine: false,
      });
      editorRef.current = editor;
      (window as unknown as { __culEditor?: monaco.editor.IStandaloneCodeEditor }).__culEditor =
        editor;
      setStatus("");
    })().catch((error: unknown) => {
      setStatus(
        error instanceof Error ? translateError(error.message, t) : "editor failed to load",
      );
    });
    return () => {
      disposed = true;
      editor?.dispose();
      editorRef.current = null;
    };
  }, [filePath]);

  const save = async () => {
    const editor = editorRef.current;
    if (!editor || busy) return;
    setBusy(true);
    setStatus(t("editor.validating"));
    try {
      const { patch } = await proposeSource({ filePath, baseHash, content: editor.getValue() });
      await applySource(patch, "gui");
      setBaseHash(patch.afterHash);
      onApplied(t("editor.applied", { count: patch.edits.length, file: filePath }));
      onClose();
    } catch (error) {
      setStatus(error instanceof Error ? translateError(error.message, t) : "apply failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 55 }}
        onClick={onClose}
      />
      <div
        className="cul-panel"
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(720px, 92vw)",
          height: "78vh",
          display: "flex",
          flexDirection: "column",
          zIndex: 60,
        }}
      >
        <div className="cul-panel-header">
          <Code2 size={14} />
          <span style={{ textTransform: "none", letterSpacing: 0, fontSize: 12 }}>{filePath}</span>
          <button
            className="cul-btn cul-btn-primary"
            style={{ marginLeft: "auto" }}
            onClick={() => void save()}
            disabled={busy}
          >
            <Save size={12} /> {t("editor.apply")}
          </button>
          <button
            className="cul-icon-btn"
            onClick={onClose}
            aria-label={t("editor.close")}
            title={t("editor.close")}
          >
            <X size={14} />
          </button>
        </div>
        <div ref={hostRef} style={{ flex: 1, minHeight: 0 }} />
        {status && (
          <p className="cul-hint" style={{ padding: "0 16px 12px", margin: 0 }}>
            {status}
          </p>
        )}
      </div>
    </>
  );
}
