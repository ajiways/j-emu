import type { BattleRules } from "./battle-rules.ts";
import { actBotSpellCard } from "./bot-spell-act.ts";
import type { HuntHuman } from "./hunt-human.ts";
import { resolveBotMelee, type BotMeleeResult } from "./hunt-melee.ts";
import type { HuntRosterBot } from "./hunt-roster-bot.ts";
import { noteCast, pickBotSpell } from "./pick-bot-spell.ts";
import type { RandomSource } from "./random-source.ts";
import { botSpellEndsTurn } from "./bot-spell-damage.ts";
import { kind1OverlayCharges } from "./magic-hit.ts";

export function resolveBotTurn(
  human: HuntHuman,
  bot: HuntRosterBot,
  state: Readonly<{
    rules: BattleRules;
    random: RandomSource;
    fightId: string;
    keepFightOnKill: boolean;
    living: readonly HuntHuman[];
    winnerTeam: 1 | 2;
  }>,
): BotMeleeResult & Readonly<{ botHp: number }> {
  if (bot.stunnedTurns > 0) {
    bot.stunnedTurns -= 1;
    return { events: [], killedPlayer: false, botHp: bot.hp };
  }
  const card = pickBotSpell(
    bot.spellBook,
    {
      botHp: bot.hp,
      botMaxHp: bot.maxHp,
      casts: bot.casts,
      foeGroups: human.effects.standingGroups(),
    },
    state.random,
  );
  if (!card) {
    return {
      ...resolveBotMelee(human, {
        ...state,
        botFightId: bot.fightId,
        botStrength: bot.strength,
        overlayOwner: bot,
        casterMag: bot.mag,
      }),
      botHp: bot.hp,
    };
  }
  noteCast(bot.casts, card.artikulId);
  const events = [...actBotSpellCard(bot, human, card, { ...state, winnerTeam: state.winnerTeam })];
  const killedPlayer = events.some((event) => event.type === "damage" && event.killed);
  if (!killedPlayer && (kind1OverlayCharges(card.spell) > 0 || !botSpellEndsTurn(card.spell))) {
    const melee = resolveBotMelee(human, {
      ...state,
      botFightId: bot.fightId,
      botStrength: bot.strength,
      overlayOwner: bot,
      casterMag: bot.mag,
    });
    return {
      events: [...events, ...melee.events],
      killedPlayer: melee.killedPlayer,
      botHp: bot.hp,
    };
  }
  return { events, killedPlayer, botHp: bot.hp };
}
