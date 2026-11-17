import { FileUp, LayoutGrid, Package } from "lucide-react";
import { useI18n } from "./i18n";

export function Onboarding({
  onImportFig,
  onInsert,
  onCatalog,
  onDismiss,
}: {
  onImportFig: () => void;
  onInsert: () => void;
  onCatalog: () => void;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const cards = [
    { icon: FileUp, label: t("onboard.fig"), run: onImportFig, primary: true },
    { icon: Package, label: t("onboard.insert"), run: onInsert, primary: false },
    { icon: LayoutGrid, label: t("onboard.catalog"), run: onCatalog, primary: false },
  ];
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 40,
        background: "color-mix(in srgb, var(--cul-bg, #f4f5f7) 72%, transparent)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("onboard.title")}
        tabIndex={-1}
        ref={(el) => el?.focus()}
        className="cul-panel"
        style={{ width: 400, padding: 24, textAlign: "center" }}
      >
        <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>{t("onboard.title")}</h2>
        <p className="cul-hint" style={{ margin: "0 0 18px" }}>
          {t("onboard.sub")}
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          {cards.map(({ icon: Icon, label, run, primary }) => (
            <button
              key={label}
              className={primary ? "cul-btn cul-btn-primary" : "cul-btn"}
              style={{ justifyContent: "center", padding: "10px 12px", fontSize: 13 }}
              onClick={() => {
                onDismiss();
                run();
              }}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        <button
          className="cul-hint"
          style={{
            marginTop: 14,
            background: "none",
            border: "none",
            cursor: "pointer",
            textDecoration: "underline",
          }}
          onClick={onDismiss}
        >
          {t("onboard.skip")}
        </button>
      </div>
    </div>
  );
}
