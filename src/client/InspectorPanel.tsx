import { Camera, MessageSquarePlus, X } from "lucide-react";
import { useState } from "react";
import type { MatrixCell } from "../domain/matrix";

export interface InspectorPanelProps {
  cell: MatrixCell;
  busy: boolean;
  onApprove: () => void;
  onAddNote: (text: string, severity: "info" | "warning" | "error") => void;
  onClose: () => void;
}

export function InspectorPanel({ cell, busy, onApprove, onAddNote, onClose }: InspectorPanelProps) {
  const [note, setNote] = useState("");
  const [severity, setSeverity] = useState<"info" | "warning" | "error">("info");

  return (
    <div className="cul-panel" style={{ position: "absolute", right: 16, top: 76, width: 300 }}>
      <div className="cul-panel-header">
        <span>{cell.componentId}</span>
        <button
          className="cul-icon-btn"
          style={{ marginLeft: "auto" }}
          onClick={onClose}
          aria-label="Close inspector"
        >
          <X size={14} />
        </button>
      </div>
      <div className="cul-panel-body">
        <p className="cul-hint" style={{ wordBreak: "break-all", marginTop: 0 }}>
          {cell.cellKey}
        </p>
        <dl className="cul-axes">
          {Object.entries(cell.axisValues).map(([axis, value]) => (
            <div key={axis}>
              <dt>{axis}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <button
          className="cul-btn cul-btn-primary"
          style={{ width: "100%", justifyContent: "center" }}
          onClick={onApprove}
          disabled={busy}
        >
          <Camera size={12} /> Approve baseline
        </button>
        <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
          <textarea
            className="cul-textarea"
            rows={2}
            placeholder="Add a note for this cell…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <select
              className="cul-select"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as typeof severity)}
            >
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="error">error</option>
            </select>
            <button
              className="cul-btn"
              disabled={busy || note.trim().length === 0}
              onClick={() => {
                onAddNote(note.trim(), severity);
                setNote("");
              }}
            >
              <MessageSquarePlus size={12} /> Pin note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
