import { useMemo } from "react";
import type { ComponentSpecData } from "../domain/brands";
import type { MatrixCell } from "../domain/matrix";
import type { ReactNode } from "react";

export function AssetsPanel({
  specs,
  renderCell,
}: {
  specs: ComponentSpecData[];
  renderCell: (cell: MatrixCell) => ReactNode;
}) {
  const items = useMemo(() => specs, [specs]);
  return (
    <div
      style={{
        overflow: "auto",
        flex: 1,
        padding: 8,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
        alignContent: "start",
      }}
    >
      {items.map((spec) => (
        <div
          key={spec.id}
          draggable
          onDragStart={(e) => e.dataTransfer.setData("application/x-cul-component", spec.id)}
          title={spec.title}
          style={{
            border: "1px solid var(--cul-border, #e2e4e8)",
            borderRadius: 6,
            padding: 6,
            cursor: "grab",
            background: "var(--cul-surface, #fff)",
          }}
        >
          <div
            style={{
              height: 64,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div style={{ transform: "scale(0.6)", transformOrigin: "center" }}>
              {renderCell({
                componentId: spec.id,
                args: {},
                axisValues: {},
                cellKey: `asset:${spec.id}`,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
              } as unknown as MatrixCell)}
            </div>
          </div>
          <div
            style={{
              fontSize: 11,
              marginTop: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {spec.title}
          </div>
        </div>
      ))}
    </div>
  );
}
