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

export function CheatSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
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
                <td style={{ padding: "3px 0", color: "var(--cul-muted, #8a8f98)" }}>{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
