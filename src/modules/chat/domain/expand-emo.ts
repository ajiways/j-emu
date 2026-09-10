import type { EmoTemplate } from "./emo-templates.ts";

export type ChatUserMacro = Readonly<{
  key: string;
  token: string;
  macro: Readonly<Record<string, unknown>>;
}>;

export type EmoExpandResult =
  | Readonly<{
      msg: string;
      macroses: Readonly<Record<string, unknown>>;
      omitFrom: true;
    }>
  | Readonly<{ missingTarget: string }>;

export function expandEmoFlavor(
  parsed: Readonly<{ target: string; tpl: EmoTemplate }>,
  self: ChatUserMacro,
  target: ChatUserMacro | null,
): EmoExpandResult {
  const macroses: Record<string, unknown> = { [self.key]: self.macro };
  let template = parsed.tpl.all;
  if (parsed.target) {
    if (!target) return { missingTarget: parsed.target };
    template = parsed.tpl.to;
    macroses[target.key] = target.macro;
    template = template.split("{target}").join(target.token);
  }
  return {
    msg: template.split("{self}").join(self.token),
    macroses,
    omitFrom: true,
  };
}
