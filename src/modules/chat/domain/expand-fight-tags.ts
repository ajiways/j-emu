import { buildFightMacro, type FightMacroToken } from "./fight-macro.ts";

const FIGHT_KW_RU = "(бой)";
const FIGHT_KW_EN = "(fight)";
const FIGHT_TAG_RE = /#FIGHT\[(\d+)\]#/g;

export type FightMacroContext = Readonly<{
  areaId: string;
  areaTitle: string;
  activeFightId: string | null;
  fightTitleFor: (fightId: string) => string;
}>;

export function expandFightKeywords(
  text: string,
  context: FightMacroContext,
  macroses: Record<string, unknown>,
  byFightId: Map<string, FightMacroToken>,
): string {
  if (!context.activeFightId) return text;
  if (!text.includes(FIGHT_KW_RU) && !text.includes(FIGHT_KW_EN)) return text;
  const token = fightToken(context.activeFightId, context, macroses, byFightId);
  return text.split(FIGHT_KW_RU).join(token.token).split(FIGHT_KW_EN).join(token.token);
}

export function expandFightHashTags(
  text: string,
  context: FightMacroContext,
  macroses: Record<string, unknown>,
  byFightId: Map<string, FightMacroToken>,
): string {
  return text.replace(FIGHT_TAG_RE, (_match, fightId: string) => {
    return fightToken(fightId, context, macroses, byFightId).token;
  });
}

function fightToken(
  fightId: string,
  context: FightMacroContext,
  macroses: Record<string, unknown>,
  byFightId: Map<string, FightMacroToken>,
): FightMacroToken {
  const cached = byFightId.get(fightId);
  if (cached) return cached;
  const token = buildFightMacro({
    fightId,
    areaId: context.areaId,
    areaTitle: context.areaTitle,
    fightTitle: context.fightTitleFor(fightId),
  });
  byFightId.set(fightId, token);
  macroses[token.key] = token.macro;
  return token;
}
