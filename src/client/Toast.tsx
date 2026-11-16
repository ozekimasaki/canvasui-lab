import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useI18n } from "./i18n";

interface ToastItem {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

const ToastContext = createContext<{
  toast: (message: string, action?: { label: string; run: () => void }) => void;
}>({ toast: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const toast = useCallback((message: string, action?: { label: string; run: () => void }) => {
    const id = nextId.current++;
    setItems((current) => [...current.slice(-3), { id, message, action }]);
    setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 6000);
  }, []);
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: 40,
          left: "50%",
          transform: "translateX(-50%)",
          display: "grid",
          gap: 8,
          zIndex: 200,
        }}
      >
        {items.map((item) => (
          <ToastRow
            key={item.id}
            item={item}
            onDone={() => setItems((current) => current.filter((i) => i.id !== item.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastRow({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const { t } = useI18n();
  return (
    <div
      className="cul-panel"
      style={{
        padding: "8px 12px",
        display: "flex",
        gap: 12,
        alignItems: "center",
        fontSize: 12,
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
      }}
    >
      <span>{item.message}</span>
      {item.action && (
        <button
          className="cul-btn"
          style={{ fontSize: 11, padding: "2px 8px" }}
          onClick={() => {
            item.action?.run();
            onDone();
          }}
        >
          {item.action.label || t("toast.undo")}
        </button>
      )}
    </div>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
