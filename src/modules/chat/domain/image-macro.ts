import { macroKeyId } from "../../../shared/kernel/macro-key-id.ts";

export type ImageMacroToken = Readonly<{
  key: string;
  token: string;
  macro: Readonly<{ key_id: string; macro_type: "IMG"; src: string }>;
}>;

export function buildImageMacro(src: string): ImageMacroToken {
  if (!src) throw new Error("Image macro src is required");
  const key = macroKeyId("IMG", src);
  return { key, token: `[[IMG ${key}]]`, macro: { key_id: key, macro_type: "IMG", src } };
}
