import { Circle, Eye, EyeOff, Frame, Package, Square, Type } from "lucide-react";
import { useState } from "react";
import type { DocAction, DocNode, Document } from "../domain/document";
import { useI18n } from "./i18n";

function iconFor(node: DocNode) {
  if (node.kind === "frame") return Frame;
  if (node.kind === "instance") return Package;
  if (node.kind === "text") return Type;
  if (node.kind === "shape" && node.shape === "ellipse") return Circle;
  return Square;
}

function Row({
  doc,
  id,
  depth,
  selection,
  onSelect,
  dispatch,
  filter,
}: {
  doc: Document;
  id: string;
  depth: number;
  selection: string[];
  onSelect: (ids: string[]) => void;
  dispatch: (a: DocAction) => void;
  filter: string;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const node = doc.nodes[id];
  if (!node) return null;
  if (filter && !node.name.toLowerCase().includes(filter.toLowerCase())) {
    if (
      node.kind !== "frame" ||
      !node.children.some((c) => doc.nodes[c]?.name.toLowerCase().includes(filter.toLowerCase()))
    )
      return null;
  }
  const Icon = iconFor(node);
  const selected = selection.includes(id);
  return (
    <>
      <div
        draggable
        onDragStart={(e) => e.dataTransfer.setData("application/x-cul-layer", id)}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("application/x-cul-layer")) e.preventDefault();
        }}
        onDrop={(e) => {
          const dragged = e.dataTransfer.getData("application/x-cul-layer");
          if (dragged && dragged !== id)
            dispatch({
              type: "reorder",
              id: dragged,
              parentId: node.kind === "frame" ? id : null,
              index: node.kind === "frame" ? 0 : doc.roots.indexOf(id),
            });
        }}
        onClick={(e) => onSelect(e.shiftKey ? [...selection, id] : [id])}
        onDoubleClick={() => setEditing(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 8px",
          paddingLeft: 8 + depth * 14,
          cursor: "default",
          background: selected ? "var(--cul-accent-soft)" : undefined,
          borderRadius: 4,
          fontSize: 12,
        }}
      >
        <Icon size={12} style={{ flexShrink: 0, opacity: 0.7 }} />
        {editing ? (
          <input
            autoFocus
            className="cul-input-field"
            style={{ width: "100%", padding: "1px 4px", fontSize: 12 }}
            defaultValue={node.name}
            onBlur={(e) => {
              dispatch({ type: "set", id, patch: { name: e.target.value || node.name } });
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <span
            style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {node.name}
          </span>
        )}
        <button
          className="cul-icon-btn"
          style={{ padding: 2 }}
          title={node.hidden ? t("show") : t("hide")}
          onClick={(e) => {
            e.stopPropagation();
            dispatch({ type: "set", id, patch: { hidden: !node.hidden } });
          }}
        >
          {node.hidden ? <EyeOff size={11} /> : <Eye size={11} />}
        </button>
      </div>
      {node.kind === "frame" &&
        node.children.map((child) => (
          <Row
            key={child}
            doc={doc}
            id={child}
            depth={depth + 1}
            selection={selection}
            onSelect={onSelect}
            dispatch={dispatch}
            filter={filter}
          />
        ))}
    </>
  );
}

export function LayersPanel({
  doc,
  selection,
  onSelect,
  dispatch,
  search,
}: {
  doc: Document;
  selection: string[];
  onSelect: (ids: string[]) => void;
  dispatch: (a: DocAction) => void;
  search: string;
}) {
  return (
    <div style={{ overflow: "auto", flex: 1, padding: 4 }}>
      {doc.roots.map((id) => (
        <Row
          key={id}
          doc={doc}
          id={id}
          depth={0}
          selection={selection}
          onSelect={onSelect}
          dispatch={dispatch}
          filter={search}
        />
      ))}
    </div>
  );
}
