import type { DesignTokenData, TokenValue } from "./brands";

export type ThemeAxes = Record<string, readonly string[]>;

export function defaultTheme(axes: ThemeAxes): Record<string, string> {
  const theme: Record<string, string> = {};
  for (const axis of Object.keys(axes).sort()) {
    const values = axes[axis];
    if (values.length > 0) theme[axis] = values[0];
  }
  return theme;
}

export function themeKey(theme: Record<string, string>): string {
  return Object.keys(theme)
    .sort()
    .map((k) => `${k}=${theme[k]}`)
    .join("|");
}

export function resolveTokenValue(
  token: DesignTokenData,
  theme: Record<string, string>,
): TokenValue | undefined {
  const exact = token.values[themeKey(theme)];
  if (exact !== undefined) return exact;
  const fallback = token.values[themeKey(defaultThemeFromToken(token))];
  if (fallback !== undefined) return fallback;
  const first = Object.values(token.values)[0];
  return first;
}

function defaultThemeFromToken(token: DesignTokenData): Record<string, string> {
  const firstKey = Object.keys(token.values)[0];
  if (!firstKey) return {};
  const theme: Record<string, string> = {};
  for (const pair of firstKey.split("|")) {
    const [k, v] = pair.split("=");
    if (k && v) theme[k] = v;
  }
  return theme;
}

export function cssVarName(tokenName: string): string {
  return `--${tokenName.replace(/[.$]/g, "-").replace(/[^a-zA-Z0-9-]/g, "-")}`;
}

export function tokensToCssVars(
  tokens: readonly DesignTokenData[],
  theme: Record<string, string>,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const token of tokens) {
    const value = resolveTokenValue(token, theme);
    if (value === undefined) continue;
    vars[cssVarName(token.name)] = String(value);
  }
  return vars;
}

export function themeCombinations(axes: ThemeAxes): Record<string, string>[] {
  const names = Object.keys(axes).sort();
  let combos: Record<string, string>[] = [{}];
  for (const name of names) {
    const next: Record<string, string>[] = [];
    for (const combo of combos) {
      for (const value of axes[name]) {
        next.push({ ...combo, [name]: value });
      }
    }
    combos = next;
  }
  return combos;
}
