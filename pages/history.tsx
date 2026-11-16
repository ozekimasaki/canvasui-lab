import { ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import type { CSSProperties } from "react";
import "../src/client/app.css";

interface RunRow {
  id: string;
  totalCells: number;
  changedCells: number;
  createdAt: string;
}

interface BaselineRow {
  id: string;
  componentId: string;
  cellKey: string;
  r2Key: string;
  createdAt: string;
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "var(--chrome-bg)",
  color: "var(--chrome-fg)",
  fontFamily: "system-ui, sans-serif",
  padding: "48px 56px",
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 16px",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--chrome-muted)",
  borderBottom: "1px solid var(--chrome-border)",
};

const tdStyle: CSSProperties = {
  padding: "12px 16px",
  fontSize: 13,
  borderBottom: "1px solid var(--chrome-border)",
};

export default function HistoryPage({
  runs,
  baselines,
}: {
  runs: RunRow[];
  baselines: BaselineRow[];
}) {
  return (
    <div style={pageStyle}>
      <a
        href="/"
        style={{
          color: "#818cf8",
          textDecoration: "none",
          fontSize: 13,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <ArrowLeft size={14} /> Back to canvas
      </a>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: "20px 0 8px" }}>Snapshot history</h1>
      <p style={{ color: "var(--chrome-muted)", fontSize: 13, margin: "0 0 32px" }}>
        VRT runs and approved baselines stored in D1 + R2.
      </p>

      <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px" }}>Runs</h2>
      {runs.length === 0 ? (
        <p style={{ color: "var(--chrome-muted)", fontSize: 13 }}>No runs yet.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", marginBottom: 40, minWidth: 560 }}>
          <thead>
            <tr>
              <th style={thStyle}>When</th>
              <th style={thStyle}>Cells</th>
              <th style={thStyle}>Changed</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td style={tdStyle}>{run.createdAt}</td>
                <td style={tdStyle}>{run.totalCells}</td>
                <td style={tdStyle}>{run.changedCells}</td>
                <td style={tdStyle}>
                  {run.changedCells === 0 ? (
                    <span
                      style={{
                        color: "#34d399",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <CheckCircle2 size={14} /> clean
                    </span>
                  ) : (
                    <span
                      style={{
                        color: "#f87171",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <AlertTriangle size={14} /> regression
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px" }}>Baselines</h2>
      {baselines.length === 0 ? (
        <p style={{ color: "var(--chrome-muted)", fontSize: 13 }}>No baselines approved yet.</p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          {baselines.map((baseline) => (
            <figure key={baseline.id} style={{ margin: 0, width: 200 }}>
              <img
                src={`/api/snapshots/png?key=${encodeURIComponent(baseline.r2Key)}`}
                alt={baseline.cellKey}
                width={200}
                style={{
                  borderRadius: 8,
                  border: "1px solid var(--chrome-border)",
                  background: "#fff",
                  display: "block",
                }}
              />
              <figcaption
                style={{
                  fontSize: 11,
                  color: "var(--chrome-muted)",
                  marginTop: 8,
                  wordBreak: "break-all",
                }}
              >
                {baseline.componentId} / {baseline.cellKey}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
