import type { TKey } from "./i18n";

const MAP: [RegExp, TKey][] = [
  [/allowlist/i, "err.allowlist"],
  [/concurrent/i, "err.concurrent"],
  [/afterHash/i, "err.afterHash"],
  [/does not parse|parse/i, "err.parse"],
  [/not found/i, "err.notfound"],
  [/usage limit/i, "err.usage"],
];

export function translateError(message: string, t: (key: TKey) => string): string {
  for (const [re, key] of MAP) if (re.test(message)) return t(key);
  return message;
}
