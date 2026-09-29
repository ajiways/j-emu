import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import { applyHuntBotHit, applyHuntPlayerHit } from "./battle-hunt-runtime.ts";
import { requireAuthedHuman, requireBattleHuman } from "./battle-lookups.ts";
import { applyPairedGloveEnding, applyPairedMelee } from "./battle-strikes.ts";
import { rosterIsPvp } from "./roster-pvp.ts";
import { requireFightBot } from "./fight-bots.ts";
import { resolveAiActorTurn } from "./resolve-ai-actor-turn.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { FightRules } from "./fight-rules.ts";
import type { EndingGloveResult } from "./glove-ending-cast.ts";
import type { KeepTurnResult } from "./hunt-cast.ts";
import { tryGloveKeepTurn } from "./hunt-cast.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { BotMeleeResult } from "./hunt-melee.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { enemySideCleared, fightCombatants } from "./melee-target.ts";
import { persChangeForParticipants } from "./melee-pers-change.ts";
import { opposingTeam } from "./opposing-team.ts";
import type { PlayerMeleeResult } from "./paired-melee.ts";
import type { RandomSource } from "./random-source.ts";
import { requireDuelContaining } from "./try-pair-hunt-queues.ts";

type HuntActionState = Readonly<{
  fightRules: FightRules;
  finished: boolean;
  humans: HumanFighter[];
  duels: FightDuel[];
  bots: BotFighter[];
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
    bots: state.bots,
    duel,
    nowMs,
  });
  return applyHuntPlayerHit(resolved, hitInput(state, human, duel));
}

export function applyBattleGlove(
  state: HuntActionState,
  accountId: number,
  spellId: number,
  sequence: string | number,
  nowMs: number,
): Readonly<{ result: KeepTurnResult | EndingGloveResult; finished: boolean }> {
  const human = requireAuthedHuman(state.humans, accountId);
  const keep = tryGloveKeepTurn(human, spellId, sequence, rosterIsPvp(state.humans));
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
    bots: state.bots,
    duel,
    duels: state.duels,
    nowMs,
  });
  if (ending.kind !== "ending") return { result: ending, finished: state.finished };
  const settle = settleGloveHits(ending, hitInput(state, human, duel));
  return { result: settle, finished: settle.finished };
}

export function applyBattleBotMelee(
  state: HuntActionState,
  accountId: number,
  living: readonly HumanFighter[],
  nowMs: number,
): BotMeleeResult & Readonly<{ finished: boolean }> {
  if (state.bots.length === 0) throw new Error("Human duel has no bot to take a turn");
  if (state.finished) throw new Error("Cannot resolve bot melee on a finished battle");
  const target = requireBattleHuman(state.humans, accountId);
  const duel = requireDuelContaining(state.duels, target.heroId);
  const bot = requireFightBot(state.bots, duel.otherId(target.heroId));
  const enemyTeam = state.fightRules.teamAssignment.enemyTeam;
  const result = resolveAiActorTurn({
    bot,
    duel,
    humans: state.humans,
    bots: state.bots,
    rules: state.rules,
    random: state.random,
    fightId: state.fightId,
    keepFightOnKill: state.humans.some(
      (entry) =>
        entry.accountId !== target.accountId &&
        entry.team === target.team &&
        !entry.leftLive &&
        entry.hp > 0,
    ),
    living,
    winnerTeam: enemyTeam,
    nowMs,
  });
  const events = [...result.events, ...botFellToTick(state, bot, target, duel, result)];
  return {
    events,
    killedPlayer: result.killedPlayer,
    finished: events.some((event) => event.type === "finished"),
  };
}

/** A DoT tick emptied the bot during its own action: end the fight or bring the next foe. */
function botFellToTick(
  state: HuntActionState,
  bot: BotFighter,
  hunter: HumanFighter,
  duel: FightDuel,
  result: BotMeleeResult,
): readonly BattleEvent[] {
  if (bot.hp > 0 || result.killedPlayer) return [];
  if (enemySideCleared(bot.team, fightCombatants(state.humans, state.bots))) {
    return [{ type: "finished", winnerTeam: opposingTeam(bot.team), fightId: state.fightId }];
  }
  return applyHuntBotHit(false, {
    bots: state.bots,
    enemyTeam: state.fightRules.teamAssignment.enemyTeam,
    duel,
    duels: state.duels,
    opener: hunter,
    humans: state.humans,
  }).events;
}

function settleGloveHits(
  ending: EndingGloveResult,
  input: Readonly<{
    bots: readonly BotFighter[];
    enemyTeam: 1 | 2;
    duel: FightDuel;
    duels: FightDuel[];
    opener: HumanFighter;
    humans: readonly HumanFighter[];
  }>,
): EndingGloveResult {
  if (ending.selfKilled) return ending;
  const primary = applyHuntBotHit(ending.finished, input);
  const sideHits = ending.sideNotifies.map((notify) => {
    if (!input.bots.some((bot) => bot.fightId === notify.targetId)) {
      return { notify, extra: [] as const };
    }
    const duel = requireDuelContaining(input.duels, notify.targetId);
    const owner = input.humans.find((human) => duel.has(human.heroId));
    if (!owner) throw new Error(`AOE extra bot ${notify.targetId} has no paired human`);
    const extra = applyHuntBotHit(primary.finished, {
      ...input,
      duel,
      opener: owner,
    });
    return { notify, extra: extra.events };
  });
  if (ending.hitTargetIds.length <= 1) {
    return {
      ...ending,
      events: [...ending.events, ...primary.events],
      finished: primary.finished,
      sideNotifies: sideHits.map(({ notify, extra }) =>
        extra.length === 0 ? notify : { ...notify, events: [...notify.events, ...extra] },
      ),
    };
  }
  const damage = ending.events.find((event) => event.type === "damage");
  if (!damage || damage.type !== "damage") {
    throw new Error("Glove ending is missing a damage event");
  }
  const bots = input.bots.map((bot) => bot.snap());
  const patch = persChangeForParticipants(input.humans, bots, [
    damage.sourceId,
    ...ending.hitTargetIds,
  ]);
  return {
    ...ending,
    events: [...ending.events, patch, ...primary.events],
    finished: primary.finished,
    sideNotifies: sideHits.map(({ notify, extra }) => ({
      ...notify,
      events: [...notify.events, patch, ...extra],
    })),
  };
}

function hitInput(
  state: HuntActionState,
  human: HumanFighter,
  duel: FightDuel,
): Readonly<{
  bots: readonly BotFighter[];
  enemyTeam: 1 | 2;
  duel: FightDuel;
  duels: FightDuel[];
  opener: HumanFighter;
  humans: readonly HumanFighter[];
}> {
  return {
    bots: state.bots,
    enemyTeam: state.fightRules.teamAssignment.enemyTeam,
    duel,
    duels: state.duels,
    opener: human,
    humans: state.humans,
  };
}
