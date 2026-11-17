import type { KeyboardEvent } from "react";

export function useTabs<T extends string>(
  tabs: readonly T[],
  value: T,
  onChange: (value: T) => void,
) {
  const onKeyDown = (event: KeyboardEvent) => {
    const index = tabs.indexOf(value);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(tabs[(index + 1) % tabs.length]);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(tabs[(index - 1 + tabs.length) % tabs.length]);
    }
  };
  return { role: "tablist" as const, onKeyDown };
}
