import { useEffect } from "react";
import { useI18n } from "./i18n";

export type ShortcutAction =
  | "undo"
  | "redo"
  | "delete"
  | "duplicate"
  | "group"
  | "ungroup"
  | "frameSelection"
  | "selectAll"
  | "clear"
  | "fit"
  | "zoomSelection"
  | "zoom100"
  | "nudgeLeft"
  | "nudgeRight"
  | "nudgeUp"
  | "nudgeDown"
  | "nudgeLeft10"
  | "nudgeRight10"
  | "nudgeUp10"
  | "nudgeDown10"
  | "alignLeft"
  | "alignRight"
  | "alignTop"
  | "alignBottom"
  | "alignHCenter"
  | "alignVCenter"
  | "flexOn"
  | "flexOff"
  | "zBack"
  | "zFront"
  | "copyPng"
  | "copyHtml"
  | "search"
  | "palette"
  | "chat"
  | "save"
  | "cheat"
  | "cut"
  | "paste"
  | "toolV"
  | "toolH"
  | "toolF"
  | "toolT"
  | "toolC"
  | "toolA"
  | "toolR"
  | "toolO"
  | "toolZ";

export const SHORTCUT_TABLE: { keys: string; action: ShortcutAction }[] = [
  { keys: "V", action: "toolV" },
  { keys: "H", action: "toolH" },
  { keys: "F", action: "toolF" },
  { keys: "T", action: "toolT" },
  { keys: "C", action: "toolC" },
  { keys: "A", action: "toolA" },
  { keys: "R", action: "toolR" },
  { keys: "O", action: "toolO" },
  { keys: "Z", action: "toolZ" },
  { keys: "Shift+1", action: "fit" },
  { keys: "Shift+2", action: "zoomSelection" },
  { keys: "Cmd+0", action: "zoom100" },
  { keys: "Cmd+A", action: "selectAll" },
  { keys: "Esc", action: "clear" },
  { keys: "Cmd+D", action: "duplicate" },
  { keys: "Cmd+X", action: "cut" },
  { keys: "Cmd+V", action: "paste" },
  { keys: "Del", action: "delete" },
  { keys: "←↑→↓", action: "nudgeLeft" },
  { keys: "Shift+←↑→↓", action: "nudgeLeft10" },
  { keys: "Cmd+G", action: "group" },
  { keys: "Cmd+Shift+G", action: "ungroup" },
  { keys: "Cmd+Opt+G", action: "frameSelection" },
  { keys: "Shift+A", action: "flexOn" },
  { keys: "Shift+Opt+A", action: "flexOff" },
  { keys: "Opt+W/A/S/D/H/V", action: "alignTop" },
  { keys: "Cmd+[ / ]", action: "zBack" },
  { keys: "Cmd+Z", action: "undo" },
  { keys: "Cmd+Shift+Z", action: "redo" },
  { keys: "Cmd+Shift+C", action: "copyPng" },
  { keys: "Cmd+Opt+C", action: "copyHtml" },
  { keys: "Cmd+F", action: "search" },
  { keys: "Cmd+P", action: "palette" },
  { keys: "Cmd+K", action: "chat" },
  { keys: "Cmd+S", action: "save" },
  { keys: "?", action: "cheat" },
];

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable ||
    Boolean(el.closest(".monaco-editor"))
  );
}

export function useShortcuts(onAction: (action: ShortcutAction) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key;
      const lower = key.toLowerCase();
      let action: ShortcutAction | null = null;
      if (mod && lower === "z") action = event.shiftKey ? "redo" : "undo";
      else if (mod && lower === "d") action = "duplicate";
      else if (mod && lower === "x") action = "cut";
      else if (mod && lower === "v") action = "paste";
      else if (mod && lower === "a") action = "selectAll";
      else if (mod && lower === "g")
        action = event.shiftKey ? "ungroup" : event.altKey ? "frameSelection" : "group";
      else if (mod && lower === "f") action = "search";
      else if (mod && lower === "p") action = "palette";
      else if (mod && lower === "k") action = "chat";
      else if (mod && lower === "s") action = "save";
      else if (mod && lower === "c")
        action = event.shiftKey ? "copyPng" : event.altKey ? "copyHtml" : null;
      else if (mod && key === "0") action = "zoom100";
      else if (mod && key === "[") action = "zBack";
      else if (mod && key === "]") action = "zFront";
      else if (event.shiftKey && key === "!") action = "fit";
      else if (event.shiftKey && key === "@") action = "zoomSelection";
      else if (event.shiftKey && lower === "a") action = event.altKey ? "flexOff" : "flexOn";
      else if (event.altKey && !mod) {
        if (lower === "w") action = "alignTop";
        else if (lower === "s") action = "alignBottom";
        else if (lower === "a") action = "alignLeft";
        else if (lower === "d") action = "alignRight";
        else if (lower === "h") action = "alignHCenter";
        else if (lower === "v") action = "alignVCenter";
      } else if (!mod && !event.altKey) {
        if (key === "Delete" || key === "Backspace") action = "delete";
        else if (key === "Escape") action = "clear";
        else if (key === "?") action = "cheat";
        else if (key.startsWith("Arrow")) {
          const dir = key.slice(5);
          const base =
            dir === "Left"
              ? "nudgeLeft"
              : dir === "Right"
                ? "nudgeRight"
                : dir === "Up"
                  ? "nudgeUp"
                  : "nudgeDown";
          action = (event.shiftKey ? `${base}10` : base) as ShortcutAction;
        } else if (!event.shiftKey) {
          const map: Record<string, ShortcutAction> = {
            v: "toolV",
            h: "toolH",
            f: "toolF",
            t: "toolT",
            c: "toolC",
            a: "toolA",
            r: "toolR",
            o: "toolO",
            z: "toolZ",
          };
          action = map[lower] ?? null;
        }
      }
      if (action) {
        event.preventDefault();
        onAction(action);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAction, enabled]);
}

const ACTION_LABELS: Record<ShortcutAction, [string, string]> = {
  undo: ["元に戻す", "Undo"],
  redo: ["やり直す", "Redo"],
  delete: ["削除", "Delete"],
  duplicate: ["複製", "Duplicate"],
  group: ["グループ化", "Group"],
  ungroup: ["グループ解除", "Ungroup"],
  frameSelection: ["フレーム化", "Frame selection"],
  selectAll: ["全選択", "Select all"],
  clear: ["選択解除", "Clear selection"],
  fit: ["全体表示", "Zoom to fit"],
  zoomSelection: ["選択にズーム", "Zoom to selection"],
  zoom100: ["100%", "100%"],
  nudgeLeft: ["1px 移動", "Nudge 1px"],
  nudgeRight: ["1px 移動", "Nudge 1px"],
  nudgeUp: ["1px 移動", "Nudge 1px"],
  nudgeDown: ["1px 移動", "Nudge 1px"],
  nudgeLeft10: ["10px 移動", "Nudge 10px"],
  nudgeRight10: ["10px 移動", "Nudge 10px"],
  nudgeUp10: ["10px 移動", "Nudge 10px"],
  nudgeDown10: ["10px 移動", "Nudge 10px"],
  alignLeft: ["左揃え", "Align left"],
  alignRight: ["右揃え", "Align right"],
  alignTop: ["上揃え", "Align top"],
  alignBottom: ["下揃え", "Align bottom"],
  alignHCenter: ["水平中央", "Align h-centers"],
  alignVCenter: ["垂直中央", "Align v-centers"],
  flexOn: ["オートレイアウト", "Auto layout on"],
  flexOff: ["オートレイアウト解除", "Auto layout off"],
  zBack: ["背面へ", "Send backward"],
  zFront: ["前面へ", "Bring forward"],
  copyPng: ["PNG コピー", "Copy PNG"],
  copyHtml: ["HTML コピー", "Copy HTML"],
  search: ["レイヤー検索", "Search layers"],
  palette: ["コマンドパレット", "Command palette"],
  chat: ["AI チャット", "AI chat"],
  save: ["保存", "Save"],
  cheat: ["チートシート", "Cheat sheet"],
  cut: ["カット", "Cut"],
  paste: ["ペースト", "Paste"],
  toolV: ["移動ツール", "Move tool"],
  toolH: ["ハンドツール", "Hand tool"],
  toolF: ["フレームツール", "Frame tool"],
  toolT: ["テキストツール", "Text tool"],
  toolC: ["コメントツール", "Comment tool"],
  toolA: ["アセット", "Assets"],
  toolR: ["長方形ツール", "Rectangle tool"],
  toolO: ["楕円ツール", "Ellipse tool"],
  toolZ: ["ズームツール", "Zoom tool"],
};

export function CheatSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useI18n();
  if (!open) return null;
  return (
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
      onClick={onClose}
    >
      <div
        className="cul-panel"
        style={{ width: 420, maxHeight: "70vh", overflow: "auto", padding: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cul-panel-header" style={{ padding: 0, marginBottom: 12 }}>
          {t("cheat.title")}
        </div>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <tbody>
            {SHORTCUT_TABLE.map(({ keys, action }) => (
              <tr key={action + keys}>
                <td
                  style={{
                    padding: "3px 8px 3px 0",
                    fontFamily: "monospace",
                    whiteSpace: "nowrap",
                  }}
                >
                  {keys}
                </td>
                <td style={{ padding: "3px 0", color: "var(--cul-muted, #8a8f98)" }}>
                  {ACTION_LABELS[action]?.[lang === "ja" ? 0 : 1] ?? action}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
