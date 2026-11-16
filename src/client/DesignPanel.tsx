import { apiFetch } from "./api";
import { diffImages, toBlob, type GpuCanvas } from "gpucanvas";
import { ChevronDown, Frame, Palette, PenTool, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { MatrixCell } from "../domain/matrix";
import { designs } from "virtual:pen-designs";
import { useI18n } from "./i18n";

interface TokenRow {
  id: string;
  source: string;
  name: string;
  type: string;
  collection: string;
  values: Record<string, string | number | boolean>;
}

interface DesignOption {
  label: string;
  r2Key: string;
}

interface CompareResult {
  designUrl: string;
  implUrl: string;
  diffUrl: string;
  ratio: number;
}

async function blobToImageData(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  const surface = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = surface.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, surface.width, surface.height);
}

export function DesignPanel({ canvas, cells }: { canvas: GpuCanvas | null; cells: MatrixCell[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [designOptions, setDesignOptions] = useState<DesignOption[]>([]);
  const [fileKey, setFileKey] = useState("");
  const [nodeIds, setNodeIds] = useState("");
  const [compareDesign, setCompareDesign] = useState("");
  const [compareCellKey, setCompareCellKey] = useState("");
  const [compare, setCompare] = useState<CompareResult | null>(null);

  const refreshTokens = useCallback(async () => {
    const res = await apiFetch("/api/tokens");
    if (res.ok) setTokens((await res.json()) as TokenRow[]);
  }, []);

  const refreshDesigns = useCallback(async () => {
    const options: DesignOption[] = [];
    const linksRes = await apiFetch("/api/figma/links");
    if (linksRes.ok) {
      const links = (await linksRes.json()) as { nodeId: string; r2Key: string }[];
      for (const link of links) options.push({ label: `figma:${link.nodeId}`, r2Key: link.r2Key });
    }
    const penRes = await fetch(
      "/api/snapshots/history?componentId=pen%3Ademo&cellKey=pen%3Ademo%3Adocument",
    );
    if (penRes.ok) {
      const rows = (await penRes.json()) as { kind: string; r2Key: string }[];
      for (const row of rows) {
        if (row.kind === "design") options.push({ label: "pen:demo", r2Key: row.r2Key });
      }
    }
    setDesignOptions(options);
  }, []);

  useEffect(() => {
    void refreshTokens();
    void refreshDesigns();
  }, [refreshTokens, refreshDesigns]);

  const importPen = async () => {
    setBusy(true);
    setMessage("");
    try {
      let imported = 0;
      const summaries: string[] = [];
      for (const design of designs) {
        const res = await apiFetch("/api/pen/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ raw: design.raw }),
        });
        const data: unknown = await res.json();
        if (!res.ok) {
          const err =
            data && typeof data === "object" && "error" in data
              ? typeof data.error === "string"
                ? data.error
                : JSON.stringify(data.error)
              : res.status;
          throw new Error(`${design.path}: ${err}`);
        }
        const result = data as { imported: number; components: { name: string }[] };
        imported += result.imported;
        summaries.push(result.components.map((c) => c.name).join(", "));
      }
      setMessage(`Imported ${imported} tokens. Components: ${summaries.join(" / ") || "none"}`);
      await refreshTokens();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "pen import failed");
    } finally {
      setBusy(false);
    }
  };

  const importFigma = async () => {
    setBusy(true);
    setMessage("");
    try {
      const res = await apiFetch("/api/figma/images", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          componentId: "figma",
          fileKey: fileKey.trim(),
          nodeIds: nodeIds
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean),
          scale: 2,
        }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const err =
          data && typeof data === "object" && "error" in data
            ? typeof data.error === "string"
              ? data.error
              : JSON.stringify(data.error)
            : res.status;
        throw new Error(String(err));
      }
      const result = data as { imported: number };
      setMessage(`Imported ${result.imported} Figma frame renders.`);
      await refreshDesigns();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Figma import failed");
    } finally {
      setBusy(false);
    }
  };

  const runCompare = async () => {
    if (!canvas || !compareDesign || !compareCellKey) return;
    if (canvas.mode !== "gpu") {
      setMessage("Compare requires the GPU backend (Chrome 157+).");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const cell = cells.find((c) => c.cellKey === compareCellKey);
      if (!cell) throw new Error("Select an implementation cell");
      const element = canvas.getNodesIn({
        x: cell.x,
        y: cell.y,
        width: cell.width,
        height: cell.height,
      })[0];
      if (!element) throw new Error("Cell not found on canvas");
      const designRes = await apiFetch(
        `/api/snapshots/png?key=${encodeURIComponent(compareDesign)}`,
      );
      if (!designRes.ok) throw new Error("Design image not found");
      const designData = await blobToImageData(await designRes.blob());
      const implData = await canvas.snapshot(element, { scale: 2 });
      const diff = diffImages(designData, implData, { threshold: 10 });
      const implBlob = await toBlob(implData);
      const diffBlob = await toBlob(diff.image);
      setCompare({
        designUrl: `/api/snapshots/png?key=${encodeURIComponent(compareDesign)}`,
        implUrl: URL.createObjectURL(implBlob),
        diffUrl: URL.createObjectURL(diffBlob),
        ratio: diff.total > 0 ? diff.changed / diff.total : 0,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Compare failed");
    } finally {
      setBusy(false);
    }
  };

  const closeCompare = () => {
    if (compare) {
      URL.revokeObjectURL(compare.implUrl);
      URL.revokeObjectURL(compare.diffUrl);
    }
    setCompare(null);
  };

  return (
    <div className="cul-panel" style={{ position: "absolute", left: 16, bottom: 16, width: 340 }}>
      <button className="cul-panel-header" onClick={() => setOpen(!open)}>
        <PenTool size={14} />
        <span>{t("design.title")}</span>
        <ChevronDown
          size={14}
          style={{ marginLeft: "auto", transform: open ? "none" : "rotate(-90deg)" }}
        />
      </button>
      {open && (
        <div className="cul-panel-body" style={{ maxHeight: "50vh", overflowY: "auto" }}>
          <section className="cul-section">
            <h4>
              <PenTool size={12} /> pen.dev
            </h4>
            <button
              className="cul-btn"
              onClick={() => void importPen()}
              disabled={busy || designs.length === 0}
            >
              Import .pen designs ({designs.length})
            </button>
          </section>

          <section className="cul-section">
            <h4>
              <Frame size={12} /> {t("design.figmaFrames")}
            </h4>
            <input
              className="cul-input-field"
              placeholder={t("design.fileKey")}
              value={fileKey}
              onChange={(e) => setFileKey(e.target.value)}
            />
            <input
              className="cul-input-field"
              placeholder={t("design.nodeIds")}
              value={nodeIds}
              onChange={(e) => setNodeIds(e.target.value)}
            />
            <button
              className="cul-btn"
              onClick={() => void importFigma()}
              disabled={busy || !fileKey || !nodeIds}
            >
              {t("design.fetch")}
            </button>
          </section>

          <section className="cul-section">
            <h4>
              <Palette size={12} /> {t("design.tokens", { count: tokens.length })}
            </h4>
            <div style={{ display: "grid", gap: 4, maxHeight: 120, overflowY: "auto" }}>
              {tokens.slice(0, 40).map((token) => (
                <div
                  key={token.id}
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}
                >
                  {token.type === "color" && (
                    <span
                      className="cul-dot"
                      style={{ background: String(Object.values(token.values)[0] ?? "#888") }}
                    />
                  )}
                  <span style={{ color: "var(--chrome-muted)" }}>{token.source}</span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {token.name}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="cul-section">
            <h4>{t("design.compare")}</h4>
            <select
              className="cul-select"
              value={compareDesign}
              onChange={(e) => setCompareDesign(e.target.value)}
            >
              <option value="">{t("design.designImage")}</option>
              {designOptions.map((option) => (
                <option key={option.r2Key} value={option.r2Key}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="cul-select"
              value={compareCellKey}
              onChange={(e) => setCompareCellKey(e.target.value)}
            >
              <option value="">{t("design.implCell")}</option>
              {cells.slice(0, 400).map((cell) => (
                <option key={cell.cellKey} value={cell.cellKey}>
                  {cell.componentId} · {Object.values(cell.axisValues).join("/")}
                </option>
              ))}
            </select>
            <button
              className="cul-btn cul-btn-primary"
              onClick={() => void runCompare()}
              disabled={busy || !compareDesign || !compareCellKey}
            >
              {t("design.compareRun")}
            </button>
          </section>

          {message && (
            <p className="cul-hint" style={{ whiteSpace: "pre-wrap" }}>
              {message}
            </p>
          )}
        </div>
      )}

      {compare && (
        <div className="cul-modal-backdrop" onClick={closeCompare}>
          <div className="cul-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cul-panel-header">
              <span>{t("design.diffRatio", { ratio: (compare.ratio * 100).toFixed(2) })}</span>
              <button
                className="cul-icon-btn"
                style={{ marginLeft: "auto" }}
                onClick={closeCompare}
                aria-label={t("design.close")}
                title={t("design.close")}
              >
                <X size={14} />
              </button>
            </div>
            <div className="cul-compare-grid">
              <figure>
                <img src={compare.designUrl} alt="Design" />
                <figcaption>{t("design.design")}</figcaption>
              </figure>
              <figure>
                <img src={compare.implUrl} alt="Implementation" />
                <figcaption>{t("design.impl")}</figcaption>
              </figure>
              <figure>
                <img src={compare.diffUrl} alt="Diff" />
                <figcaption>{t("design.diff")}</figcaption>
              </figure>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
