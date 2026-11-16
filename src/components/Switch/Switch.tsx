import { useEffect, useState } from "react";
import type { ForceState, Size } from "../types";

export interface SwitchProps {
  checked?: boolean | string;
  size?: Size;
  state?: ForceState;
  label?: string;
}

function isOn(checked: boolean | string | undefined): boolean {
  return checked === true || checked === "true" || checked === "on";
}

export function Switch({
  checked = false,
  size = "md",
  state = "default",
  label = "Notifications",
}: SwitchProps) {
  const [on, setOn] = useState(isOn(checked));
  useEffect(() => {
    setOn(isOn(checked));
  }, [checked]);
  return (
    <button
      data-component="Switch"
      data-size={size}
      data-state={state}
      data-checked={on ? "true" : "false"}
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={state === "disabled"}
      onClick={() => setOn(!on)}
    >
      <span className="cul-switch-knob" />
    </button>
  );
}
