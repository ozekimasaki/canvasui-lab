import { describe, expect, it } from "vite-plus/test";
import type { ValidatedDesignToken } from "../../src/domain/brands";
import {
  cssVarName,
  defaultTheme,
  resolveTokenValue,
  themeCombinations,
  themeKey,
  tokensToCssVars,
} from "../../src/domain/token";

const token = {
  source: "pen",
  name: "color.background",
  type: "color",
  collection: "color",
  values: { "mode=light": "#ffffff", "mode=dark": "#000000" },
} as unknown as ValidatedDesignToken;

describe("theme resolution", () => {
  it("builds stable theme keys", () => {
    expect(themeKey({ mode: "dark", spacing: "regular" })).toBe("mode=dark|spacing=regular");
    expect(themeKey({ spacing: "regular", mode: "dark" })).toBe("mode=dark|spacing=regular");
  });
  it("defaults to the first value of each axis", () => {
    expect(defaultTheme({ mode: ["light", "dark"], spacing: ["regular", "condensed"] })).toEqual({
      mode: "light",
      spacing: "regular",
    });
  });
  it("expands all theme combinations", () => {
    expect(
      themeCombinations({ mode: ["light", "dark"], spacing: ["regular", "condensed"] }),
    ).toHaveLength(4);
  });
  it("resolves per-theme values with fallback", () => {
    expect(resolveTokenValue(token, { mode: "dark" })).toBe("#000000");
    expect(resolveTokenValue(token, { mode: "light" })).toBe("#ffffff");
    expect(resolveTokenValue(token, {})).toBe("#ffffff");
  });
});

describe("CSS variables", () => {
  it("converts token names to safe custom properties", () => {
    expect(cssVarName("color.background")).toBe("--color-background");
    expect(cssVarName("text.title")).toBe("--text-title");
  });
  it("emits resolved values for a theme", () => {
    expect(tokensToCssVars([token], { mode: "dark" })).toEqual({ "--color-background": "#000000" });
  });
});
