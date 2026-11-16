import type { Size } from "../types";

export interface BadgeProps {
  variant?: "neutral" | "primary" | "success" | "warning" | "danger";
  size?: Size;
  label?: string;
}

export function Badge({ variant = "neutral", size = "md", label = "Badge" }: BadgeProps) {
  return (
    <span data-component="Badge" data-variant={variant} data-size={size}>
      {label}
    </span>
  );
}
