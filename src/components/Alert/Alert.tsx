import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { Size } from "../types";

export interface AlertProps {
  variant?: "info" | "success" | "warning" | "error";
  size?: Size;
  title?: string;
  message?: string;
}

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
} as const;

export function Alert({
  variant = "info",
  size = "md",
  title = "Heads up",
  message = "Something worth knowing about this state.",
}: AlertProps) {
  const Icon = ICONS[variant];
  return (
    <div data-component="Alert" data-variant={variant} data-size={size} role="alert">
      <Icon className="cul-alert-icon" />
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}
