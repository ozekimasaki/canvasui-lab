import { fitCamera, worldToScreen, type GpuCanvas as GpuCanvasApi } from "gpucanvas";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { descendants, type DocAction, type DocNode, type Document } from "../domain/document";
import "./app.css";
import { AssetsPanel } from "./AssetsPanel";
import { ChatPanel } from "./ChatPanel";
import { DesignPanel } from "./DesignPanel";
import { DocumentCanvas, fitDocument, zoomDocument, type Tool } from "./DocumentCanvas";
import { importFigFile } from "./figImportClient";
import { I18nProvider, useI18n } from "./i18n";
import { LayersPanel } from "./LayersPanel";
import { MarksPanel } from "./MarksPanel";
import { MatrixCanvas } from "./MatrixCanvas";
import { Onboarding } from "./Onboarding";
import { PropertiesPanel } from "./PropertiesPanel";
import { saveDocument } from "./documentClient";
import { CheatSheet, useShortcuts, type ShortcutAction } from "./shortcuts";
import { buildSpecs } from "./storiesToSpecs";
import { StatusBar } from "./StatusBar";
import { ToastProvider, useToast } from "./Toast";
import { ToolRail } from "./ToolRail";
import { TopBar } from "./TopBar";
import type { ChromeTheme } from "./Toolbar";
import { useDocument } from "./useDocument";
import { useSync } from "./useSync";

const EditorPanel = lazy(() => import("./EditorPanel"));

export function App({ appName, bridgeToken }: { appName: string; bridgeToken: string }) {
  return (
    <I18nProvider>
      <ToastProvider>
        <Shell appName={appName} bridgeToken={bridgeToken} />
      </ToastProvider>
    </I18nProvider>
  );
}

function Shell({ appName, bridgeToken }: { appName: string; bridgeToken: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [mode, setModeState] = useState<"document" | "catalog">(
    () => (localStorage.getItem("cul_mode") as "document" | "catalog") ?? "document",
  );
  const setMode = (m: "document" | "catalog") => {
    localStorage.setItem("cul_mode", m);
    setModeState(m);
  };
  const { doc, ready, dispatch, undo, redo, rename, saveState, canUndo, canRedo } = useDocument();
  const { specs, renderCell } = useMemo(buildSpecs, []);
  const [tool, setTool] = useState<Tool>("V");
  const [selection, setSelection] = useState<string[]>([]);
  const [canvas, setCanvas] = useState<GpuCanvasApi | null>(null);
  const [leftTab, setLeftTab] = useState<"layers" | "assets">("layers");
  const [rightTab, setRightTab] = useState<"design" | "code" | "variables" | "marks">("design");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [cheatOpen, setCheatOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [editorFile, setEditorFile] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [chrome, setChrome] = useState<ChromeTheme>("system");
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [onboarded, setOnboarded] = useState(() => Boolean(localStorage.getItem("cul_onboarded")));
  const [syncEnabled, setSyncEnabled] = useState(() => localStorage.getItem("cul_sync") === "1");
  const [importedFiles, setImportedFiles] = useState<string[]>([]);
  const [narrow, setNarrow] = useState(() => window.innerWidth < 1100);
  const [figReport, setFigReport] = useState<
    { nodeId: string; type: string; reason: string; approximation: string }[] | null
  >(null);
  const clipboard = useRef<{ nodes: Record<string, DocNode>; roots: string[] } | null>(null);
  const figInput = useRef<HTMLInputElement>(null);
  const docRef = useRef(doc);
  docRef.current = doc;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 1100);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const resolvedChrome = chrome === "system" ? (systemDark ? "dark" : "light") : chrome;
  useEffect(() => {
    if (chrome === "system") document.documentElement.removeAttribute("data-chrome");
    else document.documentElement.setAttribute("data-chrome", chrome);
  }, [chrome]);

  useEffect(() => {
    if (!canvas || mode !== "document") return;
    const timer = setInterval(() => setZoom(canvas.getCamera().zoom), 400);
    return () => clearInterval(timer);
  }, [canvas, mode]);

  const handleRemote = useCallback(
    (user: string) => toast(`${t("status.sync")}: ${user}`),
    [toast, t],
  );
  const { peers } = useSync(
    doc,
    dispatch,
    canvas,
    syncEnabled && mode === "document",
    handleRemote,
  );
  const toggleSync = () => {
    const next = !syncEnabled;
    localStorage.setItem("cul_sync", next ? "1" : "0");
    setSyncEnabled(next);
  };

  const handleCanvas = useCallback((next: GpuCanvasApi | null) => setCanvas(next), []);
  const handleSelection = useCallback((ids: string[]) => setSelection(ids), []);

  const insert = useCallback(
    (node: DocNode) => {
      dispatch({ type: "insert", node });
      // the editor's background-click clear fires on the same pointerup; select after it
      setTimeout(() => setSelection([node.id]), 150);
    },
    [dispatch],
  );

  const transformStart = useCallback(
    (id: string) => dispatch({ type: "set", id, patch: {} } as DocAction),
    [dispatch],
  );
  const transform = useCallback(
    (id: string, rect: { x: number; y: number; w: number; h: number }, kind: "move" | "resize") => {
      const node = docRef.current.nodes[id];
      if (!node) return;
      if (kind === "move")
        dispatch(
          { type: "move", ids: [id], dx: rect.x - node.x, dy: rect.y - node.y },
          { history: false },
        );
      else dispatch({ type: "resize", id, w: rect.w, h: rect.h }, { history: false });
    },
    [dispatch],
  );

  const deleteSelection = useCallback(() => {
    const ids = selectionRef.current;
    if (ids.length === 0) return;
    dispatch({ type: "remove", ids });
    setSelection([]);
    toast(t("toast.deleted", { count: ids.length }), { label: t("toast.undo"), run: () => undo() });
  }, [dispatch, toast, t, undo]);

  const handleFigFile = useCallback(
    async (file: File) => {
      try {
        const result = await importFigFile(file);
        dispatch({ type: "merge", nodes: result.nodes, roots: result.roots } as DocAction);
        setImportedFiles((current) => [
          ...new Set([
            ...current,
            ...result.components.filter((c) => c.written).map((c) => c.filePath),
          ]),
        ]);
        toast(t("toast.imported", { name: file.name, nodes: Object.keys(result.nodes).length }), {
          label: t("toast.undo"),
          run: () => undo(),
        });
        if (result.report.length > 0) {
          console.info("[fig-import] fidelity report", result.report);
          setFigReport(result.report);
        }
        if (canvas) setTimeout(() => fitDocument(canvas, docRef.current), 50);
      } catch (error) {
        toast(error instanceof Error ? error.message : "import failed");
      }
    },
    [dispatch, toast, t, undo, canvas],
  );

  const copySelection = useCallback(
    async (kind: "png" | "html") => {
      const id = selectionRef.current[0];
      if (!canvas || !id) return;
      const el = canvas.surface.querySelector(`[data-docnode="${id}"]`) as HTMLElement | null;
      if (!el) return;
      if (kind === "html") {
        await navigator.clipboard.writeText(el.outerHTML);
        toast("HTML copied");
        return;
      }
      const data = await canvas.snapshot(el, { scale: 2 });
      const off = document.createElement("canvas");
      off.width = data.width;
      off.height = data.height;
      off.getContext("2d")?.putImageData(data, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => off.toBlob(resolve, "image/png"));
      if (blob) await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast("PNG copied");
    },
    [canvas, toast],
  );

  const onShortcut = useCallback(
    (action: ShortcutAction) => {
      const ids = selectionRef.current;
      const current = docRef.current;
      const nudge = (dx: number, dy: number) =>
        ids.length && dispatch({ type: "move", ids, dx, dy });
      switch (action) {
        case "toolV":
        case "toolH":
        case "toolF":
        case "toolT":
        case "toolC":
        case "toolR":
        case "toolO":
        case "toolZ":
          setTool(action.slice(4) as Tool);
          break;
        case "toolA":
          setTool("A");
          setLeftTab("assets");
          break;
        case "undo":
          undo();
          break;
        case "redo":
          redo();
          break;
        case "delete":
          deleteSelection();
          break;
        case "duplicate":
          if (ids.length) dispatch({ type: "duplicate", ids });
          break;
        case "cut": {
          if (!ids.length) break;
          const subset: Record<string, DocNode> = {};
          for (const id of ids)
            for (const d of descendants(current, id)) subset[d] = current.nodes[d];
          clipboard.current = { nodes: subset, roots: ids };
          dispatch({ type: "remove", ids });
          setSelection([]);
          toast(t("toast.cut", { count: ids.length }), {
            label: t("toast.undo"),
            run: () => undo(),
          });
          break;
        }
        case "paste": {
          const clip = clipboard.current;
          if (!clip) break;
          const remap = new Map(Object.keys(clip.nodes).map((id) => [id, crypto.randomUUID()]));
          const nodes: Record<string, DocNode> = {};
          for (const [oldId, node] of Object.entries(clip.nodes)) {
            const id = remap.get(oldId)!;
            const moved = clip.roots.includes(oldId)
              ? { ...node, id, x: node.x + 24, y: node.y + 24 }
              : { ...node, id };
            nodes[id] =
              moved.kind === "frame"
                ? { ...moved, children: moved.children.map((c) => remap.get(c) ?? c) }
                : moved;
          }
          const roots = clip.roots.map((id) => remap.get(id)!);
          dispatch({ type: "merge", nodes, roots });
          setSelection(roots);
          toast(t("toast.paste", { count: roots.length }));
          break;
        }
        case "group": {
          if (!ids.length) break;
          const groupId = crypto.randomUUID();
          dispatch({ type: "group", ids, name: "Group", id: groupId });
          setSelection([groupId]);
          break;
        }
        case "ungroup": {
          const frame = ids[0] ? current.nodes[ids[0]] : undefined;
          if (frame?.kind === "frame") {
            dispatch({ type: "ungroup", id: frame.id });
            setSelection(frame.children);
          }
          break;
        }
        case "frameSelection": {
          if (!ids.length) break;
          const frameId = crypto.randomUUID();
          dispatch({ type: "group", ids, name: "Frame", id: frameId });
          setSelection([frameId]);
          break;
        }
        case "selectAll":
          setSelection(current.roots);
          break;
        case "clear":
          setSelection([]);
          setSearchOpen(false);
          setPaletteOpen(false);
          break;
        case "fit":
          if (canvas) fitDocument(canvas, current);
          break;
        case "zoom100":
          if (canvas) canvas.setCamera({ ...canvas.getCamera(), zoom: 1 });
          break;
        case "zoomSelection": {
          if (!canvas) break;
          const nodes = ids.map((id) => current.nodes[id]).filter(Boolean);
          if (nodes.length === 0) break;
          const minX = Math.min(...nodes.map((n) => n.x));
          const minY = Math.min(...nodes.map((n) => n.y));
          const maxX = Math.max(...nodes.map((n) => n.x + n.w));
          const maxY = Math.max(...nodes.map((n) => n.y + n.h));
          const rect = canvas.surface.getBoundingClientRect();
          canvas.setCamera(
            fitCamera(
              { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
              rect.width,
              rect.height,
              80,
            ),
          );
          break;
        }
        case "nudgeLeft":
          nudge(-1, 0);
          break;
        case "nudgeRight":
          nudge(1, 0);
          break;
        case "nudgeUp":
          nudge(0, -1);
          break;
        case "nudgeDown":
          nudge(0, 1);
          break;
        case "nudgeLeft10":
          nudge(-10, 0);
          break;
        case "nudgeRight10":
          nudge(10, 0);
          break;
        case "nudgeUp10":
          nudge(0, -10);
          break;
        case "nudgeDown10":
          nudge(0, 10);
          break;
        case "alignLeft":
          dispatch({ type: "align", ids, mode: "left" });
          break;
        case "alignRight":
          dispatch({ type: "align", ids, mode: "right" });
          break;
        case "alignTop":
          dispatch({ type: "align", ids, mode: "top" });
          break;
        case "alignBottom":
          dispatch({ type: "align", ids, mode: "bottom" });
          break;
        case "alignHCenter":
          dispatch({ type: "align", ids, mode: "hcenter" });
          break;
        case "alignVCenter":
          dispatch({ type: "align", ids, mode: "vcenter" });
          break;
        case "flexOn": {
          const frame = ids.map((id) => current.nodes[id]).find((n) => n?.kind === "frame");
          if (frame)
            dispatch({
              type: "set",
              id: frame.id,
              patch: {
                flex: { dir: "h", gap: 8, pad: [8, 8, 8, 8], align: "start", justify: "start" },
              },
            } as DocAction);
          break;
        }
        case "flexOff": {
          const frame = ids.map((id) => current.nodes[id]).find((n) => n?.kind === "frame");
          if (frame) dispatch({ type: "set", id: frame.id, patch: { flex: null } } as DocAction);
          break;
        }
        case "zBack":
        case "zFront": {
          const id = ids[0];
          if (!id) break;
          const parent = Object.values(current.nodes).find(
            (n) => n.kind === "frame" && n.children.includes(id),
          );
          const list = parent && parent.kind === "frame" ? parent.children : current.roots;
          dispatch({
            type: "reorder",
            id,
            parentId: parent?.id ?? null,
            index: action === "zBack" ? 0 : list.length - 1,
          });
          break;
        }
        case "copyPng":
          void copySelection("png");
          break;
        case "copyHtml":
          void copySelection("html");
          break;
        case "search":
          setLeftTab("layers");
          setSearchOpen(true);
          break;
        case "palette":
          setPaletteOpen(true);
          break;
        case "chat":
          setEditorFile(null);
          setChatOpen(true);
          break;
        case "save":
          void saveDocument(current).then(() => toast(t("status.saved")));
          break;
        case "cheat":
          setCheatOpen(true);
          break;
      }
    },
    [dispatch, undo, redo, deleteSelection, canvas, copySelection, toast, t],
  );

  useShortcuts(onShortcut, mode === "document");

  if (mode === "catalog") {
    return (
      <div className="cul-app">
        <MatrixCanvas
          appName={appName}
          bridgeToken={bridgeToken}
          onOpenDocument={() => setMode("document")}
        />
      </div>
    );
  }

  const selectedInstance = selection.map((id) => doc.nodes[id]).find((n) => n?.kind === "instance");
  const selectedSpec =
    selectedInstance && selectedInstance.kind === "instance"
      ? specs.find((s) => s.id === selectedInstance.componentId)
      : undefined;

  return (
    <div
      className="cul-app"
      style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}
    >
      <DocumentCanvas
        doc={doc}
        tool={tool}
        setTool={setTool}
        selection={selection}
        onSelection={handleSelection}
        onInsert={insert}
        onTransformStart={transformStart}
        onTransform={transform}
        onCanvas={handleCanvas}
        specs={specs}
        renderCell={renderCell}
        chrome={resolvedChrome}
      />
      <TopBar
        appName={appName}
        mode={mode}
        setMode={setMode}
        docName={doc.name}
        onRename={rename}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => undo()}
        onRedo={() => redo()}
        zoom={zoom}
        onFit={() => canvas && fitDocument(canvas, doc)}
        onZoom100={() => canvas && canvas.setCamera({ ...canvas.getCamera(), zoom: 1 })}
        onZoomIn={() => canvas && zoomDocument(canvas, 1.25)}
        onZoomOut={() => canvas && zoomDocument(canvas, 0.8)}
        onChat={() => {
          setEditorFile(null);
          setChatOpen(true);
        }}
        chrome={chrome}
        onCycleChrome={() =>
          setChrome((c) => (c === "system" ? "light" : c === "light" ? "dark" : "system"))
        }
        syncEnabled={syncEnabled}
        onToggleSync={toggleSync}
      />
      <ToolRail
        tool={tool}
        setTool={(next) => {
          setTool(next);
          if (next === "A") setLeftTab("assets");
        }}
      />
      {!(narrow && chatOpen) && (
        <div
          className="cul-panel"
          style={{
            position: "absolute",
            left: 64,
            top: 60,
            bottom: 32,
            width: 240,
            display: "flex",
            flexDirection: "column",
            zIndex: 20,
          }}
        >
          <div className="cul-panel-header" style={{ gap: 4 }}>
            {(["layers", "assets"] as const).map((tab) => (
              <button
                key={tab}
                className="cul-btn"
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  background:
                    leftTab === tab ? "var(--cul-accent-soft, rgba(139,92,246,0.15))" : undefined,
                }}
                onClick={() => setLeftTab(tab)}
              >
                {t(tab === "layers" ? "panel.layers" : "panel.assets")}
              </button>
            ))}
          </div>
          {searchOpen && leftTab === "layers" && (
            <input
              autoFocus
              className="cul-input-field"
              style={{ margin: 8, fontSize: 12 }}
              placeholder={t("search.layers")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
            />
          )}
          {leftTab === "layers" ? (
            <LayersPanel
              doc={doc}
              selection={selection}
              onSelect={setSelection}
              dispatch={dispatch}
              search={search}
            />
          ) : (
            <AssetsPanel specs={specs} renderCell={renderCell} />
          )}
        </div>
      )}
      <div
        className="cul-panel"
        style={{
          position: "absolute",
          right: 16,
          top: 60,
          bottom: 32,
          width: 280,
          display: "flex",
          flexDirection: "column",
          zIndex: 20,
        }}
      >
        <div className="cul-panel-header" style={{ gap: 4 }}>
          {(["design", "code", "variables", "marks"] as const).map((tab) => (
            <button
              key={tab}
              className="cul-btn"
              style={{
                fontSize: 11,
                padding: "2px 6px",
                background:
                  rightTab === tab ? "var(--cul-accent-soft, rgba(139,92,246,0.15))" : undefined,
              }}
              onClick={() => setRightTab(tab)}
            >
              {t(
                tab === "design"
                  ? "panel.design"
                  : tab === "code"
                    ? "panel.code"
                    : tab === "variables"
                      ? "panel.variables"
                      : "panel.marks",
              )}
            </button>
          ))}
        </div>
        {rightTab === "design" && (
          <PropertiesPanel
            doc={doc}
            selection={selection}
            dispatch={dispatch}
            specs={specs}
            canvas={canvas}
            onEditSource={setEditorFile}
            onToast={(message, action) => toast(message, action)}
          />
        )}
        {rightTab === "code" && (
          <div style={{ padding: 12, display: "grid", gap: 8 }}>
            {selectedSpec ? (
              <button
                className="cul-btn cul-btn-primary"
                style={{ justifyContent: "center" }}
                onClick={() => setEditorFile(selectedSpec.filePath)}
              >
                {selectedSpec.filePath}
              </button>
            ) : (
              <p className="cul-hint" style={{ margin: 0 }}>
                {t("empty.doc")}
              </p>
            )}
            {specs.map((spec) => (
              <button
                key={spec.id}
                className="cul-btn"
                style={{ fontSize: 11, justifyContent: "flex-start" }}
                onClick={() => setEditorFile(spec.filePath)}
              >
                {spec.title}
              </button>
            ))}
            {importedFiles.map((filePath) => (
              <button
                key={filePath}
                className="cul-btn"
                style={{ fontSize: 11, justifyContent: "flex-start" }}
                onClick={() => setEditorFile(filePath)}
              >
                {filePath.replace("src/components/imported/", "")}
              </button>
            ))}
          </div>
        )}
        {rightTab === "variables" && <DesignPanel canvas={canvas} cells={[]} embedded />}
        {rightTab === "marks" && <MarksPanel canvas={canvas} embedded />}
      </div>
      <StatusBar
        selectionCount={selection.length}
        zoom={zoom}
        canvas={canvas}
        saveState={saveState}
        syncEnabled={syncEnabled}
      />
      {syncEnabled &&
        canvas &&
        peers.map((peer) => {
          const camera = canvas.getCamera();
          const point = worldToScreen(camera, { x: peer.x, y: peer.y });
          return (
            <div
              key={peer.userId}
              style={{
                position: "absolute",
                left: point.x,
                top: point.y,
                zIndex: 35,
                pointerEvents: "none",
                transform: "translate(-2px,-2px)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14">
                <path d="M1 1 L13 6 L7 8 L5 13 Z" fill={peer.color} />
              </svg>
              <span
                style={{
                  fontSize: 10,
                  background: peer.color,
                  color: "#fff",
                  borderRadius: 4,
                  padding: "1px 5px",
                  marginLeft: 10,
                }}
              >
                {peer.name}
              </span>
            </div>
          );
        })}
      {ready && !onboarded && doc.roots.length === 0 && (
        <Onboarding
          onImportFig={() => figInput.current?.click()}
          onInsert={() => setLeftTab("assets")}
          onCatalog={() => setMode("catalog")}
          onDismiss={() => {
            localStorage.setItem("cul_onboarded", "1");
            setOnboarded(true);
          }}
        />
      )}
      <CheatSheet open={cheatOpen} onClose={() => setCheatOpen(false)} />
      {figReport && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setFigReport(null)}
        >
          <div
            className="cul-panel"
            style={{ width: 560, maxHeight: "70vh", overflow: "auto", padding: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cul-panel-header" style={{ padding: 0, marginBottom: 4 }}>
              {t("report.title")}
            </div>
            <p className="cul-hint" style={{ margin: "0 0 10px" }}>
              {t("report.sub", { count: figReport.length })}
            </p>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: "3px 6px 3px 0" }}>{t("report.node")}</th>
                  <th style={{ padding: "3px 6px" }}>{t("report.type")}</th>
                  <th style={{ padding: "3px 6px" }}>{t("report.reason")}</th>
                  <th style={{ padding: "3px 0 3px 6px" }}>{t("report.approx")}</th>
                </tr>
              </thead>
              <tbody>
                {figReport.map((entry, i) => (
                  <tr key={i}>
                    <td style={{ padding: "3px 6px 3px 0", fontFamily: "monospace" }}>
                      {entry.nodeId}
                    </td>
                    <td style={{ padding: "3px 6px" }}>{entry.type}</td>
                    <td style={{ padding: "3px 6px" }}>{entry.reason}</td>
                    <td style={{ padding: "3px 0 3px 6px" }}>{entry.approximation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              className="cul-btn"
              style={{ marginTop: 12 }}
              onClick={() => setFigReport(null)}
            >
              {t("report.close")}
            </button>
          </div>
        </div>
      )}
      {paletteOpen && (
        <Palette
          onClose={() => setPaletteOpen(false)}
          actions={[
            { label: t("onboard.fig"), run: () => figInput.current?.click() },
            { label: t("mode.catalog"), run: () => setMode("catalog") },
            { label: t("fit"), run: () => canvas && fitDocument(canvas, doc) },
            { label: t("cheat.title"), run: () => setCheatOpen(true) },
            { label: t("ai.open"), run: () => setChatOpen(true) },
          ]}
        />
      )}
      {chatOpen && (
        <ChatPanel
          doc={doc}
          selection={selection}
          specs={specs}
          canvas={canvas}
          onClose={() => setChatOpen(false)}
          onDocChange={(next) =>
            dispatch({ type: "merge", nodes: next.nodes, roots: next.roots } as DocAction)
          }
          onToast={(message, action) => toast(message, action)}
        />
      )}
      {editorFile && (
        <Suspense
          fallback={
            <div
              className="cul-panel"
              style={{ position: "absolute", right: 16, top: 76, padding: 16 }}
            >
              Loading editor…
            </div>
          }
        >
          <EditorPanel
            filePath={editorFile}
            onClose={() => setEditorFile(null)}
            onApplied={(message) => {
              toast(message);
              canvas?.invalidate();
            }}
          />
        </Suspense>
      )}
      <input
        ref={figInput}
        type="file"
        accept=".fig"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFigFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function Palette({
  onClose,
  actions,
}: {
  onClose: () => void;
  actions: { label: string; run: () => void }[];
}) {
  const [query, setQuery] = useState("");
  const filtered = actions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 100,
        display: "flex",
        justifyContent: "center",
        paddingTop: 120,
      }}
      onClick={onClose}
    >
      <div
        className="cul-panel"
        style={{ width: 380, padding: 8, height: "fit-content" }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          className="cul-input-field"
          style={{ width: "100%", marginBottom: 6 }}
          placeholder="…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && filtered[0]) {
              onClose();
              filtered[0].run();
            }
          }}
        />
        {filtered.map((a) => (
          <button
            key={a.label}
            className="cul-btn"
            style={{ width: "100%", justifyContent: "flex-start", fontSize: 12 }}
            onClick={() => {
              onClose();
              a.run();
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export type { Document };
