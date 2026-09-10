import type { Hero } from "../modules/character/domain/hero.ts";
import { expandEmoFlavor } from "../modules/chat/domain/expand-emo.ts";
import { EMO_TEMPLATES } from "../modules/chat/domain/emo-templates.ts";
import {
  expandFightHashTags,
  expandFightKeywords,
  type FightMacroContext,
} from "../modules/chat/domain/expand-fight-tags.ts";
import { expandSmileTags, type SmileCatalogEntry } from "../modules/chat/domain/expand-smiles.ts";
import { unknownFightTitle } from "../modules/chat/domain/fight-macro.ts";
import { parseEmoCommand } from "../modules/chat/domain/parse-emo-command.ts";
import { buildUserMacro } from "../modules/jugger-wire/application/user-macro.ts";

export type PlayerChatExpand =
  | Readonly<{
      msg: string;
      macroses: Readonly<Record<string, unknown>>;
      omitFrom?: true;
    }>
  | Readonly<{ missingTarget: string }>;

export async function expandPlayerChat(input: {
  text: string;
  hero: Hero;
  areaId: string;
  areaTitle: string;
  activeFightId: string | null;
  smiles: readonly SmileCatalogEntry[];
  findByNick: (nick: string) => Promise<Hero | null>;
}): Promise<PlayerChatExpand> {
  const macroses: Record<string, unknown> = {};
  const byFightId = new Map();
  const fightContext: FightMacroContext = {
    areaId: input.areaId,
    areaTitle: input.areaTitle,
    activeFightId: input.activeFightId,
    fightTitleFor: unknownFightTitle,
  };
  const emo = parseEmoCommand(input.text);
  if (emo) {
    if (emo.code === "бой" && input.activeFightId) {
      const msg = expandFightKeywords("(бой)", fightContext, macroses, byFightId);
      return { msg, macroses };
    }
    const tpl = "tpl" in emo ? emo.tpl : EMO_TEMPLATES.бой;
    if (!tpl) throw new Error(`Emotive template for ${emo.code} is missing`);
    const self = userMacro(input.hero);
    let target = null;
    if (emo.target) {
      const other = await input.findByNick(emo.target);
      if (!other) return { missingTarget: emo.target };
      target = userMacro(other);
    }
    return expandEmoFlavor({ target: emo.target, tpl }, self, target);
  }
  let msg = expandFightKeywords(input.text, fightContext, macroses, byFightId);
  msg = expandFightHashTags(msg, fightContext, macroses, byFightId);
  msg = expandSmileTags(msg, input.smiles, macroses);
  return { msg, macroses };
}

function userMacro(hero: Hero) {
  return buildUserMacro({ nick: hero.nick, level: hero.level, kind: hero.kind });
}
