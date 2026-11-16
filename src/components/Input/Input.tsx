import type { ForceState, Size } from "../types";

export interface InputProps {
  size?: Size;
  state?: ForceState;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
}

export function Input({
  size = "md",
  state = "default",
  label = "Email",
  placeholder = "you@example.com",
  defaultValue = "",
}: InputProps) {
  return (
    <label data-component="Input" data-size={size} data-state={state}>
      <span className="cul-input-label">{label}</span>
      <input
        placeholder={placeholder}
        defaultValue={defaultValue}
        disabled={state === "disabled"}
      />
    </label>
  );
}
