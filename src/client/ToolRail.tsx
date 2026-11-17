import {
  Frame,
  Hand,
  MessageSquare,
  MousePointer2,
  Package,
  Square,
  Circle,
  Type,
  ZoomIn,
} from "lucide-react";
import type { Tool } from "./DocumentCanvas";
import { useI18n, type TKey } from "./i18n";

const tools: { tool: Tool; icon: typeof Hand; key: TKey }[] = [
  { tool: "V", icon: MousePointer2, key: "tool.move" },
  { tool: "H", icon: Hand, key: "tool.hand" },
  { tool: "F", icon: Frame, key: "tool.frame" },
  { tool: "T", icon: Type, key: "tool.text" },
  { tool: "C", icon: MessageSquare, key: "tool.comment" },
  { tool: "A", icon: Package, key: "tool.assets" },
  { tool: "R", icon: Square, key: "tool.rect" },
  { tool: "O", icon: Circle, key: "tool.ellipse" },
  { tool: "Z", icon: ZoomIn, key: "tool.zoom" },
];

export function ToolRail({ tool, setTool }: { tool: Tool; setTool: (t: Tool) => void }) {
  const { t } = useI18n();
  return (
    <div
      className="cul-panel"
      style={{
        position: "absolute",
        left: 16,
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: 6,
        zIndex: 20,
      }}
    >
      {tools.map(({ tool: value, icon: Icon, key }) => (
        <button
          key={value}
          className="cul-icon-btn"
          title={t(key)}
          aria-label={t(key)}
          aria-pressed={tool === value}
          onClick={() => setTool(value)}
          style={
            tool === value
              ? {
                  background: "var(--cul-accent-soft)",
                  color: "var(--cul-accent)",
                }
              : undefined
          }
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}
