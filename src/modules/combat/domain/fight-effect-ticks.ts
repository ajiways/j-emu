import type { HuntBotSpellCard } from "./hunt-bot-spell-book.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { HuntRosterBot } from "./hunt-roster-bot.ts";
import { spellSkillValue } from "./magic-hit.ts";

const DEFAULT_TICK_PERIOD = 20;

export function attachSpellTicks(
  carrier: HuntHuman,
  caster: HuntRosterBot,
  card: HuntBotSpellCard,
): void {
  for (const effect of card.spell.effects) {
    if (effect.kind !== 4 && effect.kind !== 5) continue;
    carrier.effects.attachTick({
      kind: effect.kind,
      sourceId: caster.fightId,
      artikulId: card.artikulId,
      title: card.artikulId.toString(),
      img: "",
      dmgType: effect.dmgType ?? 0,
      ...(card.spell.groupId !== undefined ? { groupId: card.spell.groupId } : {}),
      duration: effect.duration ?? DEFAULT_TICK_PERIOD,
      period: effect.period && effect.period > 0 ? effect.period : DEFAULT_TICK_PERIOD,
      ...(effect.amount !== undefined ? { amount: effect.amount } : {}),
      catalogPcStr: spellSkillValue(effect, "pcSTR"),
      catalogStr: spellSkillValue(effect, "STR"),
      casterStrength: caster.strength,
      casterMagPower: caster.magPower,
      casterMagResist: caster.magResist,
    });
  }
}
