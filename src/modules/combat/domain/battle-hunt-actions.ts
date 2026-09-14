import type { BattleRules } from "./battle-rules.ts";
import { applyHuntBotHit, applyHuntPlayerHit } from "./battle-hunt-runtime.ts";
import {
  battleOpener,
  huntRosterBots,
  requireAuthedHuman,
  requireBattleHuman,
  requireBattleHuntRoster,
  requireHuntInit,
} from "./battle-lookups.ts";
import { applyBotTurn, applyPairedGloveEnding, applyPairedMelee } from "./battle-strikes.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { FriendlyDuelBattleInit } from "./friendly-duel-battle-init.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
import type { EndingGloveResult, KeepTurnResult } from "./hunt-cast.ts";
import { tryGloveKeepTurn } from "./hunt-cast.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { BotMeleeResult } from "./hunt-melee.ts";
import type { HuntRoster } from "./hunt-roster.ts";
import type { PlayerMeleeResult } from "./paired-melee.ts";
import type { RandomSource } from "./random-source.ts";
import { requireDuelContaining } from "./try-pair-hunt-queues.ts";

type HuntActionState = Readonly<{
  kind: "hunt" | "friendly-duel" | "pvp";
  finished: boolean;
  humans: HuntHuman[];
  duels: FightDuel[];
  huntRoster: HuntRoster | null;
  init: HuntBattleInit | FriendlyDuelBattleInit;
  rules: BattleRules;
  random: RandomSource;
  fightId: string;
}>;

export function applyBattlePlayerMelee(
  state: HuntActionState,
  accountId: number,
  side: "left" | "center" | "right",
  nowMs: number,
): Readonly<{ result: PlayerMeleeResult; finished: boolean }> {
  const human = requireAuthedHuman(state.humans, accountId);
  if (human.waiting || !human.turnActive || state.finished) {
    return { result: { kind: "ignored" }, finished: state.finished };
  }
  const duel = requireDuelContaining(state.duels, human.heroId);
  const resolved = applyPairedMelee({
    attacker: human,
    side,
    finished: state.finished,
    rules: state.rules,
    random: state.random,
    fightId: state.fightId,
    humans: state.humans,
    bots: huntRosterBots(state.huntRoster),
    duel,
    nowMs,
  });
  return applyHuntPlayerHit(resolved, {
    roster: state.huntRoster,
    duel,
    duels: state.duels,
    opener: battleOpener(state.humans),
    humans: state.humans,
  });
}

export function applyBattleGlove(
  state: HuntActionState,
  accountId: number,
  spellId: number,
  sequence: string | number,
  nowMs: number,
): Readonly<{ result: KeepTurnResult | EndingGloveResult; finished: boolean }> {
  const human = requireAuthedHuman(state.humans, accountId);
  const keep = tryGloveKeepTurn(human, spellId, sequence);
  if (keep.kind !== "ignored") return { result: keep, finished: state.finished };
  const duel = requireDuelContaining(state.duels, human.heroId);
  const ending = applyPairedGloveEnding({
    human,
    spellId,
    sequence,
    finished: state.finished,
    rules: state.rules,
    random: state.random,
    fightId: state.fightId,
    humans: state.humans,
    bots: huntRosterBots(state.huntRoster),
    duel,
    nowMs,
  });
  if (ending.kind !== "ending") return { result: ending, finished: state.finished };
  const extra = applyHuntBotHit(ending.hitBot, ending.finished, {
    roster: state.huntRoster,
    duel,
    duels: state.duels,
    opener: battleOpener(state.humans),
    humans: state.humans,
  });
  if (extra.events.length === 0) return { result: ending, finished: extra.finished };
  return {
    result: { ...ending, events: [...ending.events, ...extra.events] },
    finished: extra.finished,
  };
}

export function applyBattleBotMelee(
  state: HuntActionState,
  accountId: number,
  living: readonly HuntHuman[],
): BotMeleeResult & Readonly<{ finished: boolean }> {
  if (state.kind !== "hunt") throw new Error("Human duel has no bot to take a turn");
  const roster = requireBattleHuntRoster(state.huntRoster);
  if (state.finished) throw new Error("Cannot resolve bot melee on a finished battle");
  const hunt = requireHuntInit(state.init);
  const target = requireBattleHuman(state.humans, accountId);
  const duel = requireDuelContaining(state.duels, target.heroId);
  const bot = roster.bot(duel.otherId(target.heroId));
  const result = applyBotTurn({
    target,
    rules: state.rules,
    random: state.random,
    hunt: {
      ...hunt,
      botFightId: bot.fightId,
      botStrength: bot.strength,
      botMaxHp: bot.maxHp,
      botSpellBook: bot.spellBook,
    },
    botHp: bot.hp,
    fightId: state.fightId,
    keepFightOnKill: state.humans.some(
      (entry) =>
        entry.accountId !== target.accountId &&
        entry.team === target.team &&
        !entry.leftLive &&
        entry.hp > 0,
    ),
    casts: bot.casts,
    living,
    duel,
  });
  bot.setHp(result.botHp);
  return {
    ...result,
    finished: result.events.some((event) => event.type === "finished"),
  };
}
