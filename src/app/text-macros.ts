import type { WindowMacro } from "../modules/jugger-wire/application/progress-window.ts";

const MACRO_TOKEN = /\[\[([A-Z_]+) ([0-9a-f]{32})\]\]/g;

/** Macros referenced by `[[TYPE key]]` tokens in `text`, resolved from common_conf `macros_list`. */
export function macrosReferencedBy(text: string, macrosList: unknown): readonly WindowMacro[] {
  if (macrosList === null || typeof macrosList !== "object" || Array.isArray(macrosList)) {
    throw new Error("common_conf.macros_list must be an object");
  }
  const table = macrosList as Record<string, unknown>;
  const found = new Map<string, WindowMacro>();
  for (const match of text.matchAll(MACRO_TOKEN)) {
    const key = match[2];
    if (key === undefined || found.has(key)) continue;
    const macro = table[key];
    if (macro === undefined || macro === null || typeof macro !== "object") {
      throw new Error(`Macro ${match[1]} ${key} is missing from common_conf.macros_list`);
    }
    found.set(key, { key, token: match[0], macro });
  }
  return [...found.values()];
}
