import { EMO_TEMPLATES, type EmoTemplate } from "./emo-templates.ts";

const EMO_RE = /^\/emo\s+(\S+)(?:\s+(.*))?$/i;

export type EmoParse =
  | Readonly<{ code: "бой"; target: string }>
  | Readonly<{ code: string; target: string; tpl: EmoTemplate }>;

export function parseEmoCommand(text: string): EmoParse | null {
  const match = text.trim().match(EMO_RE);
  if (!match) return null;
  const code = match[1];
  if (!code) return null;
  const lowered = code.toLowerCase();
  const targetGroup = match[2];
  const target = (targetGroup === undefined ? "" : targetGroup).trim().replace(/\.+$/, "").trim();
  if (lowered === "бой") return { code: "бой", target };
  const tpl = EMO_TEMPLATES[lowered];
  if (!tpl) return null;
  return { code: lowered, target, tpl };
}
