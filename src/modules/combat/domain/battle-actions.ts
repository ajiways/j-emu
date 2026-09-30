import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import { settleAfterMobFell, settleAfterPlayerHit } from "./battle-runtime.ts";
import { requireAuthedHuman } from "./battle-lookups.ts";
import { applyPairedGloveEnding, applyPairedMelee } from "./battle-strikes.ts";
import { rosterIsPvp } from "./roster-pvp.ts";
import { requireFightBot } from "./fight-bots.ts";
import { resolveAiActorTurn } from "./resolve-ai-actor-turn.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { FightRules } from "./fight-rules.ts";
import type { EndingGloveResult } from "./glove-ending-cast.ts";
import type { KeepTurnResult } from "./player-casts.ts";
import { tryGloveKeepTurn } from "./player-casts.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { BotMeleeResult } from "./turn-grant.ts";
import { settleBotSideHits } from "./bot-side-hits.ts";
import type { Fallout } from "./settle-fallen.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { duelFoe, enemySideCleared } from "./melee-target.ts";
import type { Participant } from "./participant.ts";
import { persChangeForParticipants } from "./melee-pers-change.ts";
import type { PlayerMeleeResult } from "./paired-melee.ts";
import type { RandomSource } from "./random-source.ts";
import { dissolveDuelContaining, requireDuelContaining } from "./pairing.ts";

/** A bot's turn, with what its AOE spell did to the others it reached. */
export type BotTurnResult = BotMeleeResult &
  Readonly<{
    finished: boolean;
    sideFallout: Fallout;
    /** The account of the player across from the bot; `null` when the foe is a mob. */
    foeAccountId: number | null;
  }>;

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
  return settleAfterPlayerHit(resolved, hitInput(state, human, duel));
}

export function applyBattleGlove(
  state: HuntActionState,
  accountId: number,
  spellId: number,
  sequence: string | number,
  nowMs: number,
): Readonly<{ result: KeepTurnResult | EndingGloveResult; finished: boolean }> {
  const human = requireAuthedHuman(state.humans, accountId);
  const keep = tryGloveKeepTurn(human, spellId, sequence, rosterIsPvp(state.humans), {
    nowMs,
    foe: () =>
      duelFoe(
        requireDuelContaining(state.duels, human.heroId),
        [...state.humans, ...state.bots],
        human.id,
      ),
  });
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

export function applyBattleAiTurn(
  state: HuntActionState,
  botId: number,
  nowMs: number,
): BotTurnResult {
  if (state.finished) throw new Error("Cannot resolve an AI turn on a finished battle");
  const bot = requireFightBot(state.bots, botId);
  const duel = requireDuelContaining(state.duels, bot.id);
  const everyone = [...state.humans, ...state.bots];
  const foe = duelFoe(duel, everyone, bot.id);
  const result = resolveAiActorTurn({
    bot,
    duel,
    humans: state.humans,
    bots: state.bots,
    rules: state.rules,
    random: state.random,
    fightId: state.fightId,
    nowMs,
  });
  if (foe.fighterKind !== "human" && !foe.alive) {
    // The dead foe stays in the dissolved duel; the mob that struck him is freed to wait.
    dissolveDuelContaining(state.duels, everyone, foe.id);
  }
  const side = settleBotSideHits({
    sideHits: result.sideHits,
    bot,
    aimed: foe,
    humans: state.humans,
    bots: state.bots,
    duels: state.duels,
    fightRules: state.fightRules,
    fightId: state.fightId,
  });
  const events = [
    ...result.events,
    ...(side.patch ? [side.patch] : []),
    ...botFellInTurn(state, bot, foe, duel, result),
    ...(side.fallout.finished && !result.events.some((event) => event.type === "finished")
      ? [side.fallout.finished]
      : []),
  ];
  return {
    events,
    killedPlayer: result.killedPlayer,
    sideHits: result.sideHits,
    sideFallout: side.fallout,
    finished: events.some((event) => event.type === "finished"),
    foeAccountId: foe.fighterKind === "human" ? (foe as HumanFighter).accountId : null,
  };
}

/** The bot fell during its own turn (a tick, a drain): the fight goes on, so its foe is freed. */
function botFellInTurn(
  state: HuntActionState,
  bot: BotFighter,
  foe: Participant,
  duel: FightDuel,
  result: BotMeleeResult,
): readonly BattleEvent[] {
  if (bot.alive || result.killedPlayer) return [];
  const everyone = [...state.humans, ...state.bots];
  if (enemySideCleared(bot.team, everyone)) return [];
  if (foe.fighterKind !== "human") {
    dissolveDuelContaining(state.duels, everyone, bot.id);
    return [];
  }
  return settleAfterMobFell(false, {
    bots: state.bots,
    enemyTeam: state.fightRules.teamAssignment.enemyTeam,
    duel,
    duels: state.duels,
    opener: foe as HumanFighter,
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
  const primary = settleAfterMobFell(ending.finished, input);
  const sideHits = ending.sideNotifies.map((notify) => {
    if (!input.bots.some((bot) => bot.fightId === notify.targetId)) {
      return { notify, extra: [] as const };
    }
    const duel = requireDuelContaining(input.duels, notify.targetId);
    const owner = input.humans.find((human) => duel.has(human.heroId));
    if (!owner) throw new Error(`AOE extra bot ${notify.targetId} has no paired human`);
    const extra = settleAfterMobFell(primary.finished, {
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
