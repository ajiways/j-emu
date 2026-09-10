import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import {
  botSpellAnimation,
  botSpellEndsTurn,
  botSpellKind1DmgType,
  rollBotSpellDamage,
} from "./bot-spell-damage.ts";
import type { HuntBotSpellBook } from "./hunt-bot-spell-book.ts";
import type { HuntHuman } from "./hunt-human.ts";
import { pocketHealAmount, spellKind } from "./hunt-human-cast-state.ts";
import { resolveBotMelee, type BotMeleeResult } from "./hunt-melee.ts";
import { noteCast, pickBotSpell } from "./pick-bot-spell.ts";
import type { RandomSource } from "./random-source.ts";

export function resolveBotTurn(
  human: HuntHuman,
  state: Readonly<{
    rules: BattleRules;
    random: RandomSource;
    botFightId: number;
    botStrength: number;
    botHp: number;
    botMaxHp: number;
    fightId: string;
    hasWaiter: boolean;
    book: HuntBotSpellBook;
    casts: Map<number, number>;
    living: readonly HuntHuman[];
  }>,
): BotMeleeResult & Readonly<{ botHp: number }> {
  const card = pickBotSpell(
    state.book,
    { botHp: state.botHp, botMaxHp: state.botMaxHp, casts: state.casts },
    state.random,
  );
  if (!card) {
    return { ...resolveBotMelee(human, state), botHp: state.botHp };
  }
  noteCast(state.casts, card.artikulId);
  if (spellKind(card.spell, 1)) {
    const struck = applyKind1(human, card.artikulId, card.spell, state);
    if (!botSpellEndsTurn(card.spell) && !struck.killedPlayer) {
      const melee = resolveBotMelee(human, state);
      return {
        events: [...struck.events, ...melee.events],
        killedPlayer: melee.killedPlayer,
        botHp: state.botHp,
      };
    }
    return { ...struck, botHp: state.botHp };
  }
  if (spellKind(card.spell, 2)) {
    return applyHeal(card.artikulId, card.spell, state);
  }
  throw new Error(`Bot spell ${card.artikulId} has no supported CMB-06 effect`);
}

function applyKind1(
  human: HuntHuman,
  artikulId: number,
  spell: HuntBotSpellBook["spells"][number]["spell"],
  state: Readonly<{
    rules: BattleRules;
    random: RandomSource;
    botFightId: number;
    botStrength: number;
    fightId: string;
    hasWaiter: boolean;
    living: readonly HuntHuman[];
  }>,
): BotMeleeResult {
  const targets = kind1Targets(human, spell, state.living);
  const animation = botSpellAnimation(spell, artikulId);
  const dmgType = botSpellKind1DmgType(spell);
  const events: BattleEvent[] = [];
  let killedPlayer = false;
  for (const target of targets) {
    if (target.waiting || target.hp === 0) {
      throw new Error("Bot spell target is not a living hunter");
    }
    const damage = rollBotSpellDamage(state.botStrength, spell, state.random, state.rules);
    const killed = target.applyDamage(damage);
    const dRage = target.casts.awardIncomingRage(damage, target.maxHp);
    events.push({
      type: "damage",
      sourceId: state.botFightId,
      targetId: target.heroId,
      animation,
      hpChange: -damage,
      targetMaxHp: target.maxHp,
      killed,
      dRage,
      dmgType,
    });
    if (killed && target.accountId === human.accountId) killedPlayer = true;
  }
  if (killedPlayer && !state.hasWaiter) {
    events.push({ type: "finished", winnerTeam: 2, fightId: state.fightId });
  }
  return { events, killedPlayer };
}

function applyHeal(
  artikulId: number,
  spell: HuntBotSpellBook["spells"][number]["spell"],
  state: Readonly<{
    botFightId: number;
    botHp: number;
    botMaxHp: number;
  }>,
): BotMeleeResult & Readonly<{ botHp: number }> {
  const healed = Math.min(state.botMaxHp - state.botHp, pocketHealAmount(spell, state.botMaxHp));
  const botHp = state.botHp + healed;
  return {
    botHp,
    killedPlayer: false,
    events: [
      {
        type: "damage",
        sourceId: state.botFightId,
        targetId: state.botFightId,
        animation: botSpellAnimation(spell, artikulId),
        hpChange: healed,
        targetMaxHp: state.botMaxHp,
        killed: false,
      },
    ],
  };
}

function kind1Targets(
  paired: HuntHuman,
  spell: HuntBotSpellBook["spells"][number]["spell"],
  living: readonly HuntHuman[],
): readonly HuntHuman[] {
  const count = spell.effects.find((effect) => effect.kind === 1)?.targetCount ?? 1;
  if (count < 2) return [paired];
  const foes = living.filter((human) => !human.waiting && human.hp > 0);
  if (foes.length < 1) throw new Error("AOE bot spell has no living hunters");
  return foes;
}
