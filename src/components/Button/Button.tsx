import type { ButtonHTMLAttributes } from "react";
import type { ForceState, Size } from "../types";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: Size;
  variant?: "solid" | "outline" | "ghost";
  state?: ForceState;
  label?: string;
}

export function Button({
  size = "md",
  variant = "solid",
  state = "default",
  label = "Proceed",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      data-component="Button"
      data-size={size}
      data-variant={variant}
      data-state={state}
      disabled={disabled || state === "disabled"}
      {...rest}
    >
      {label}
    </button>
  );
}
