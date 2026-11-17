import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  Code2,
  Download,
  PenLine,
} from "lucide-react";
import type { GpuCanvas as GpuCanvasApi } from "gpucanvas";
import type { ComponentSpecData } from "../domain/brands";
import type { DocAction, Document, FlexLayout } from "../domain/document";
import { flexStyle } from "./DocumentCanvas";
import { useI18n } from "./i18n";
import { translateError } from "./errors";
import { ScrubInput } from "./ScrubInput";
import { applySource, proposeSource } from "./sourceClient";

const ALIGN_MODES = [
  { mode: "left", icon: AlignStartHorizontal, key: "align.left" },
  { mode: "hcenter", icon: AlignCenterHorizontal, key: "align.hcenter" },
  { mode: "right", icon: AlignEndHorizontal, key: "align.right" },
  { mode: "top", icon: AlignStartVertical, key: "align.top" },
  { mode: "vcenter", icon: AlignCenterVertical, key: "align.vcenter" },
  { mode: "bottom", icon: AlignEndVertical, key: "align.bottom" },
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--cul-border, #e2e4e8)" }}>
      <p className="cul-hint" style={{ margin: "0 0 8px", fontWeight: 600 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

export function PropertiesPanel({
  doc,
  selection,
  dispatch,
  specs,
  canvas,
  onEditSource,
  onToast,
}: {
  doc: Document;
  selection: string[];
  dispatch: (a: DocAction, opts?: { history?: boolean }) => void;
  specs: ComponentSpecData[];
  canvas: GpuCanvasApi | null;
  onEditSource: (filePath: string) => void;
  onToast: (message: string, action?: { label: string; run: () => void }) => void;
}) {
  const { t } = useI18n();
  const nodes = selection.map((id) => doc.nodes[id]).filter(Boolean);
  if (nodes.length === 0) {
    return (
      <div className="cul-hint" style={{ padding: 16 }}>
        {t("empty.doc")}
      </div>
    );
  }
  const node = nodes[0];
  const spec = node.kind === "instance" ? specs.find((s) => s.id === node.componentId) : undefined;

  const set = (patch: Record<string, unknown>, history = true) =>
    dispatch({ type: "set", id: node.id, patch } as DocAction, { history });

  const exportPng = async () => {
    if (!canvas) return;
    const el = canvas.surface.querySelector(`[data-docnode="${node.id}"]`);
    if (!el) return;
    const data = await canvas.snapshot(el as HTMLElement, { scale: 2 });
    const off = document.createElement("canvas");
    off.width = data.width;
    off.height = data.height;
    off.getContext("2d")?.putImageData(data, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => off.toBlob(resolve, "image/png"));
    if (blob) await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    onToast("PNG copied");
  };

  const exportHtml = async () => {
    if (!canvas) return;
    const el = canvas.surface.querySelector(`[data-docnode="${node.id}"]`);
    if (el) await navigator.clipboard.writeText(el.outerHTML);
    onToast("HTML copied");
  };

  const writeClass = async () => {
    if (!spec || node.kind !== "instance") return;
    try {
      const { patch } = await proposeSource({
        filePath: spec.filePath,
        anchor: {
          kind: "jsx-attribute",
          component: spec.title,
          name: "className",
          value: node.className ?? "",
        },
      });
      await applySource(patch, "gui");
      onToast(t("toast.propWritten", { file: spec.filePath }));
      canvas?.invalidate();
    } catch (error) {
      onToast(error instanceof Error ? translateError(error.message, t) : t("toast.writeFailed"));
    }
  };

  return (
    <div style={{ overflow: "auto", flex: 1 }}>
      <Section title={t("props.transform")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <ScrubInput label="X" value={node.x} onChange={(v) => set({ x: v })} />
          <ScrubInput label="Y" value={node.y} onChange={(v) => set({ y: v })} />
          <ScrubInput label="W" value={node.w} min={8} onChange={(v) => set({ w: v })} />
          <ScrubInput label="H" value={node.h} min={8} onChange={(v) => set({ h: v })} />
        </div>
      </Section>
      {nodes.length > 1 && (
        <Section title={t("props.align")}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {ALIGN_MODES.map(({ mode, icon: Icon, key }) => (
              <button
                key={mode}
                className="cul-icon-btn"
                title={t(key)}
                onClick={() => dispatch({ type: "align", ids: selection, mode })}
              >
                <Icon size={14} />
              </button>
            ))}
            <button
              className="cul-btn"
              onClick={() => dispatch({ type: "distribute", ids: selection, axis: "h" })}
            >
              {t("align.distH")}
            </button>
            <button
              className="cul-btn"
              onClick={() => dispatch({ type: "distribute", ids: selection, axis: "v" })}
            >
              {t("align.distV")}
            </button>
          </div>
        </Section>
      )}
      {node.kind === "frame" && (
        <Section title={t("props.flex")}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {([null, "h", "v"] as const).map((dir) => (
                <button
                  key={String(dir)}
                  className="cul-btn"
                  style={{
                    flex: 1,
                    background:
                      (node.flex?.dir ?? null) === dir ? "var(--cul-accent-soft)" : undefined,
                  }}
                  onClick={() =>
                    set({
                      flex:
                        dir === null
                          ? null
                          : ({
                              dir,
                              gap: 8,
                              pad: [8, 8, 8, 8],
                              align: "start",
                              justify: "start",
                            } satisfies FlexLayout),
                    })
                  }
                >
                  {dir === null
                    ? t("flex.none")
                    : dir === "h"
                      ? t("flex.horizontal")
                      : t("flex.vertical")}
                </button>
              ))}
            </div>
            {node.flex && (
              <>
                <ScrubInput
                  label={t("flex.gap")}
                  value={node.flex.gap}
                  min={0}
                  onChange={(v) => set({ flex: { ...node.flex!, gap: v } })}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
                  {node.flex.pad.map((p, i) => (
                    <ScrubInput
                      key={i}
                      label={["T", "R", "B", "L"][i]}
                      value={p}
                      min={0}
                      onChange={(v) => {
                        const pad = [...node.flex!.pad] as FlexLayout["pad"];
                        pad[i] = v;
                        set({ flex: { ...node.flex!, pad } });
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <select
                    className="cul-select"
                    style={{ flex: 1, fontSize: 11 }}
                    value={node.flex.align}
                    onChange={(e) =>
                      set({ flex: { ...node.flex!, align: e.target.value as FlexLayout["align"] } })
                    }
                  >
                    {["start", "center", "end", "stretch"].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <select
                    className="cul-select"
                    style={{ flex: 1, fontSize: 11 }}
                    value={node.flex.justify}
                    onChange={(e) =>
                      set({
                        flex: { ...node.flex!, justify: e.target.value as FlexLayout["justify"] },
                      })
                    }
                  >
                    {["start", "center", "end", "between", "around"].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--cul-muted, #8a8f98)",
                    fontFamily: "monospace",
                    wordBreak: "break-all",
                  }}
                >
                  {JSON.stringify(flexStyle(node.flex))}
                </div>
              </>
            )}
          </div>
        </Section>
      )}
      {(node.kind === "frame" || node.kind === "shape") && (
        <Section title={t("props.appearance")}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11 }}>
              fill
              <input
                type="color"
                value={node.fill ?? "#ffffff"}
                onChange={(e) => set({ fill: e.target.value })}
                style={{ width: 28, height: 20, padding: 0, border: "none" }}
              />
              <input
                className="cul-input-field"
                style={{ flex: 1, fontSize: 11, padding: "2px 4px" }}
                value={node.fill ?? ""}
                placeholder="transparent"
                onChange={(e) => set({ fill: e.target.value || undefined })}
              />
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11 }}>
              stroke
              <input
                className="cul-input-field"
                style={{ flex: 1, fontSize: 11, padding: "2px 4px" }}
                value={node.stroke ?? ""}
                placeholder="none"
                onChange={(e) => set({ stroke: e.target.value || undefined })}
              />
            </label>
            <ScrubInput
              label="R"
              value={node.radius ?? 0}
              min={0}
              onChange={(v) => set({ radius: v })}
            />
          </div>
        </Section>
      )}
      {node.kind === "text" && (
        <Section title={t("props.typography")}>
          <div style={{ display: "grid", gap: 6 }}>
            <textarea
              className="cul-textarea"
              rows={2}
              value={node.content}
              onChange={(e) => set({ content: e.target.value }, false)}
              onBlur={() => set({ content: node.content })}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <ScrubInput label="S" value={node.size} min={1} onChange={(v) => set({ size: v })} />
              <ScrubInput
                label="W"
                value={node.weight}
                step={100}
                min={100}
                onChange={(v) => set({ weight: v })}
              />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="color"
                value={node.color}
                onChange={(e) => set({ color: e.target.value })}
                style={{ width: 28, height: 20, padding: 0, border: "none" }}
              />
              <select
                className="cul-select"
                style={{ flex: 1, fontSize: 11 }}
                value={node.align}
                onChange={(e) => set({ align: e.target.value })}
              >
                {["left", "center", "right"].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Section>
      )}
      {node.kind === "instance" && spec && (
        <Section title={`${t("props.instance")} · ${spec.title}`}>
          <div style={{ display: "grid", gap: 6 }}>
            {Object.entries(spec.axes ?? {}).map(([name, options]) => (
              <label key={name} style={{ display: "grid", gap: 2, fontSize: 11 }}>
                {name}
                <select
                  className="cul-select"
                  style={{ fontSize: 11 }}
                  value={(() => {
                    const current = node.overrides[name];
                    return typeof current === "string" ||
                      typeof current === "number" ||
                      typeof current === "boolean"
                      ? String(current)
                      : options[0];
                  })()}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const value = raw === "true" ? true : raw === "false" ? false : raw;
                    set({ overrides: { ...node.overrides, [name]: value } });
                  }}
                >
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button className="cul-btn" onClick={() => onEditSource(spec.filePath)}>
              <Code2 size={12} /> Monaco
            </button>
          </div>
        </Section>
      )}
      {node.kind === "instance" && (
        <Section title={t("props.classname")}>
          <div style={{ display: "grid", gap: 6 }}>
            <input
              className="cul-input-field"
              style={{ fontSize: 11 }}
              value={node.className ?? ""}
              placeholder="flex items-center gap-2"
              onChange={(e) => set({ className: e.target.value }, false)}
              onBlur={() => set({ className: node.className })}
            />
            <button className="cul-btn" onClick={() => void writeClass()} disabled={!spec}>
              <PenLine size={12} /> {t("props.writeSource")}
            </button>
          </div>
        </Section>
      )}
      <Section title={t("props.export")}>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="cul-btn" style={{ flex: 1 }} onClick={() => void exportPng()}>
            <Download size={12} /> {t("props.png")}
          </button>
          <button className="cul-btn" style={{ flex: 1 }} onClick={() => void exportHtml()}>
            <Code2 size={12} /> {t("props.html")}
          </button>
        </div>
      </Section>
    </div>
  );
}
