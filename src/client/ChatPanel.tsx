import { Bot, Send, Wrench, X } from "lucide-react";
import type { GpuCanvas as GpuCanvasApi } from "gpucanvas";
import { useRef, useState } from "react";
import type { ComponentSpecData } from "../domain/brands";
import type { Document } from "../domain/document";
import { apiFetch } from "./api";
import { useI18n } from "./i18n";
import { translateError } from "./errors";
import { applySource, proposeSource } from "./sourceClient";

interface ChatAction {
  tool: string;
  args: {
    filePath?: string;
    anchor?: {
      kind: "jsx-attribute";
      component?: string;
      name: string;
      value: string | number | boolean;
    };
  };
}

export function ChatPanel({
  doc,
  selection,
  specs,
  canvas,
  onClose,
  onToast,
}: {
  doc: Document;
  selection: string[];
  specs: ComponentSpecData[];
  canvas: GpuCanvasApi | null;
  onClose: () => void;
  onDocChange: (doc: Document) => void;
  onToast: (message: string, action?: { label: string; run: () => void }) => void;
}) {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [actions, setActions] = useState<ChatAction[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const context = () => ({
    language: lang,
    components: specs.map((spec) => ({ id: spec.id, title: spec.title, filePath: spec.filePath })),
    selection: selection
      .map((id) => doc.nodes[id])
      .filter(Boolean)
      .map((node) => ({
        id: node.id,
        kind: node.kind,
        name: node.name,
        ...(node.kind === "instance"
          ? { componentId: node.componentId, overrides: node.overrides }
          : {}),
      })),
  });

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next, context: context() }),
      });
      const data = (await res.json()) as { reply: string; actions: ChatAction[] };
      setMessages([...next, { role: "assistant", content: data.reply || "(no reply)" }]);
      setActions(data.actions ?? []);
    } catch (error) {
      setMessages([
        ...next,
        { role: "assistant", content: error instanceof Error ? error.message : "chat failed" },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => listRef.current?.scrollTo({ top: 1e9 }), 50);
    }
  };

  const confirmAction = async (action: ChatAction) => {
    if (action.tool !== "source.propose" || !action.args.filePath || !action.args.anchor) return;
    try {
      const { patch } = await proposeSource(action.args as never);
      await applySource(patch, "ai");
      onToast(t("toast.propWritten", { file: action.args.filePath }));
      setActions((current) => current.filter((a) => a !== action));
      canvas?.invalidate();
    } catch (error) {
      onToast(error instanceof Error ? translateError(error.message, t) : t("toast.writeFailed"));
    }
  };

  const heal = async () => {
    const node = selection.map((id) => doc.nodes[id]).find((n) => n?.kind === "instance");
    if (!node || node.kind !== "instance" || !canvas) {
      onToast("Select a component instance first");
      return;
    }
    const spec = specs.find((s) => s.id === node.componentId);
    if (!spec) return;
    setBusy(true);
    try {
      for (let iteration = 1; iteration <= 3; iteration++) {
        const el = canvas.surface.querySelector(
          `[data-docnode="${node.id}"]`,
        ) as HTMLElement | null;
        if (!el) break;
        const data = await canvas.snapshot(el, { scale: 1 });
        const off = document.createElement("canvas");
        off.width = data.width;
        off.height = data.height;
        off.getContext("2d")?.putImageData(data, 0, 0);
        const image = off.toDataURL("image/png");
        const res = await apiFetch("/api/heal", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            filePath: spec.filePath,
            goal: input.trim() || "fix visual issues",
            image,
            component: spec.title,
          }),
        });
        const result = (await res.json()) as {
          issues: { description: string }[];
          patches: { patch: never; description: string }[];
        };
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: `heal ${iteration}: ${result.issues.map((i) => i.description).join("; ") || "no issues"}`,
          },
        ]);
        if (result.patches.length === 0) break;
        await applySource(result.patches[0].patch, "ai");
        canvas.invalidate();
        onToast(`heal ${iteration}: ${result.patches[0].description}`);
        await new Promise((r) => setTimeout(r, 400));
      }
    } catch (error) {
      onToast(error instanceof Error ? translateError(error.message, t) : "heal failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="cul-panel"
      style={{
        position: "absolute",
        right: 312,
        top: 60,
        bottom: 32,
        width: "min(340px, calc(100vw - 320px))",
        display: "flex",
        flexDirection: "column",
        zIndex: 25,
      }}
    >
      <div className="cul-panel-header">
        <Bot size={14} /> AI
        <button
          className="cul-icon-btn"
          style={{ marginLeft: "auto" }}
          onClick={onClose}
          aria-label={t("chat.close")}
        >
          <X size={14} />
        </button>
      </div>
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflow: "auto",
          padding: 12,
          display: "grid",
          gap: 8,
          alignContent: "start",
        }}
      >
        {messages.length === 0 && (
          <p className="cul-hint" style={{ margin: 0 }}>
            {t("ai.open")}
          </p>
        )}
        {messages.map((message, i) => (
          <div
            key={i}
            style={{
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: 8,
              background:
                message.role === "user"
                  ? "var(--cul-accent-soft, rgba(139,92,246,0.12))"
                  : "var(--cul-surface-2, rgba(128,128,128,0.08))",
              whiteSpace: "pre-wrap",
            }}
          >
            {message.content}
          </div>
        ))}
        {actions.map((action, i) => (
          <div key={i} className="cul-panel" style={{ padding: 8, fontSize: 11 }}>
            <div style={{ marginBottom: 6, fontFamily: "monospace", wordBreak: "break-all" }}>
              {action.args.filePath} · {action.args.anchor?.name} ={" "}
              {JSON.stringify(action.args.anchor?.value)}
            </div>
            <button
              className="cul-btn cul-btn-primary"
              onClick={() => void confirmAction(action)}
              disabled={busy}
            >
              <Wrench size={11} /> Apply
            </button>
          </div>
        ))}
      </div>
      <div
        style={{
          padding: 8,
          borderTop: "1px solid var(--cul-border, #e2e4e8)",
          display: "flex",
          gap: 6,
        }}
      >
        <button
          className="cul-btn"
          onClick={() => void heal()}
          disabled={busy}
          title={t("chat.heal")}
        >
          <Wrench size={12} />
        </button>
        <input
          className="cul-input-field"
          style={{ flex: 1, fontSize: 12 }}
          value={input}
          placeholder={lang === "ja" ? "変更を指示…" : "Ask for a change…"}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
        />
        <button
          className="cul-icon-btn"
          onClick={() => void send()}
          disabled={busy || !input.trim()}
          aria-label={t("chat.send")}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
