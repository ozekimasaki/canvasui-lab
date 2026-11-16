import { useRef, useState } from "react";

export function ScrubInput({
  label,
  value,
  onChange,
  step = 1,
  min,
  disabled,
  title,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  disabled?: boolean;
  title?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const start = useRef({ x: 0, v: 0 });
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        opacity: disabled ? 0.5 : 1,
      }}
      title={title}
      onPointerDown={(e) => {
        if (disabled || (e.target as HTMLElement).tagName === "INPUT") return;
        start.current = { x: e.clientX, v: value };
        setDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        const delta = Math.round((e.clientX - start.current.x) / 2) * step;
        let next = start.current.v + delta;
        if (min !== undefined) next = Math.max(min, next);
        onChange(next);
      }}
      onPointerUp={() => setDragging(false)}
    >
      <span
        style={{
          cursor: disabled ? "default" : "ew-resize",
          userSelect: "none",
          width: 14,
          color: "var(--cul-muted, #8a8f98)",
        }}
      >
        {label}
      </span>
      <input
        className="cul-input-field"
        style={{ width: "100%", padding: "2px 4px", fontSize: 11 }}
        type="number"
        value={Math.round(value * 100) / 100}
        disabled={disabled}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onChange(min !== undefined ? Math.max(min, next) : next);
        }}
      />
    </label>
  );
}
