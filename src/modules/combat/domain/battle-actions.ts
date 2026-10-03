import type { Roster } from "./roster.ts";
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
import { tryGloveKeepTurn, tryPocketCast } from "./player-casts.ts";
import { allyTargetsOf } from "./spell-target.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { BotMeleeResult } from "./turn-grant.ts";
import { replaceFallen, shuffleAfterHits } from "./duel-shuffle.ts";
import type { ShuffleOutcome } from "./try-shuffle-after-hits.ts";
import { settleBotSideHits } from "./bot-side-hits.ts";
import type { Fallout } from "./settle-fallen.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { duelFoe, enemySideCleared } from "./melee-target.ts";
import type { Participant } from "./participant.ts";
import { persChangeForParticipants } from "./melee-pers-change.ts";
import type { PlayerMeleeResult } from "./paired-melee.ts";
import type { RandomSource } from "./random-source.ts";
import { requireDuelContaining } from "./pairing.ts";

export type DuelChange = Exclude<ShuffleOutcome, { kind: "none" }>;

/** A bot's turn, with what its AOE spell did to the others it reached. */
export type BotTurnResult = BotMeleeResult &
  Readonly<{
    finished: boolean;
    sideFallout: Fallout;
    /** The account of the player across from the bot; `null` when the foe is a mob. */
    foeAccountId: number | null;
    /** Changes of who stands across from whom that the turn brought about, besides the foe's. */
    changes: readonly DuelChange[];
  }>;

type HuntActionState = Readonly<{
  fightRules: FightRules;
  finished: boolean;
  roster: Roster;
  duels: FightDuel[];
  rules: BattleRules;
  random: RandomSource;
  /** Rolls who strikes first against the next mob of a hunter. */
  openingRandom: RandomSource;
  fightId: string;
}>;

export function applyBattlePlayerMelee(
  state: HuntActionState,
  accountId: number,
  side: "left" | "center" | "right",
  nowMs: number,
): Readonly<{ result: PlayerMeleeResult; finished: boolean }> {
  const human = requireAuthedHuman(state.roster.humans, accountId);
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
    roster: state.roster,
    duel,
    nowMs,
  });
  return settleAfterPlayerHit(resolved, hitInput(state, human, duel));
}

/** A pocket item the player uses: the item and the unit he clicked. */
export type PocketCast = Readonly<{
  itemId: number;
  targetId: number | null;
  sequence: string | number;
}>;

export function applyBattlePocket(
  state: HuntActionState,
  accountId: number,
  pocket: PocketCast,
  nowMs: number,
): KeepTurnResult {
  const human = requireAuthedHuman(state.roster.humans, accountId);
  return tryPocketCast(
    human,
    pocket.itemId,
    nowMs,
    pocket.sequence,
    rosterIsPvp(state.roster.humans),
    (spell) =>
      allyTargetsOf({
        spell,
        caster: human,
        roster: state.roster,
        targetId: pocket.targetId,
        sequence: pocket.sequence,
        random: state.random,
      }),
  );
}

/** A glove spell the player casts: what he clicked and the command it came with. */
export type GloveCast = Readonly<{
  spellId: number;
  targetId: number | null;
  sequence: string | number;
}>;

export function applyBattleGlove(
  state: HuntActionState,
  accountId: number,
  glove: GloveCast,
  nowMs: number,
): Readonly<{ result: KeepTurnResult | EndingGloveResult; finished: boolean }> {
  const { spellId, sequence } = glove;
  const human = requireAuthedHuman(state.roster.humans, accountId);
  const keep = tryGloveKeepTurn(human, spellId, sequence, rosterIsPvp(state.roster.humans), {
    nowMs,
    foe: () =>
      duelFoe(requireDuelContaining(state.duels, human.heroId), state.roster.all(), human.id),
    allies: (spell) =>
      allyTargetsOf({
        spell,
        caster: human,
        roster: state.roster,
        targetId: glove.targetId,
        sequence,
        random: state.random,
      }),
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
    roster: state.roster,
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
  const bot = requireFightBot(state.roster.bots, botId);
  const duel = requireDuelContaining(state.duels, bot.id);
  const everyone = state.roster.all();
  const foe = duelFoe(duel, everyone, bot.id);
  const result = resolveAiActorTurn({
    bot,
    duel,
    roster: state.roster,
    rules: state.rules,
    random: state.random,
    fightId: state.fightId,
    nowMs,
  });
  const changes: DuelChange[] = [];
  if (bot.alive && foe.fighterKind !== "human" && !foe.alive) {
    // The foe fell: the next of his team stands across from the mob that struck him.
    const next = replaceFallen({ dead: foe, ...participantsOf(state) });
    if (next) changes.push(next);
  }
  const side = settleBotSideHits({
    sideHits: result.sideHits,
    bot,
    aimed: foe,
    roster: state.roster,
    duels: state.duels,
    fightRules: state.fightRules,
    fightId: state.fightId,
    openingRandom: state.openingRandom,
  });
  const events = [
    ...result.events,
    ...(side.patch ? [side.patch] : []),
    ...botFellInTurn(state, bot, foe, duel, result, changes),
    ...(side.fallout.finished && !result.events.some((event) => event.type === "finished")
      ? [side.fallout.finished]
      : []),
  ];
  // A duel with a player in it is shuffled when the player's turn ends, by the application.
  if (
    !events.some((event) => event.type === "finished") &&
    state.fightRules.rotatesDuels &&
    foe.fighterKind !== "human"
  ) {
    const shuffle = shuffleAfterHits({ actor: bot, finished: false, ...participantsOf(state) });
    if (shuffle.kind !== "none") changes.push(shuffle);
  }
  return {
    events,
    changes,
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
  changes: DuelChange[],
): readonly BattleEvent[] {
  if (bot.alive || result.killedPlayer) return [];
  if (enemySideCleared(bot.team, state.roster.all())) return [];
  if (foe.fighterKind === "human") {
    // A player is told in the packet of the turn itself; the rest of the change is the same.
    return settleAfterMobFell(false, {
      roster: state.roster,
      duel,
      duels: state.duels,
      opener: foe as HumanFighter,
      openingRandom: state.openingRandom,
    }).events;
  }
  if (!foe.alive) return [];
  const next = replaceFallen({ dead: bot, ...participantsOf(state) });
  if (next) changes.push(next);
  return [];
}

function participantsOf(state: HuntActionState): Readonly<{
  humans: readonly HumanFighter[];
  bots: readonly BotFighter[];
  duels: FightDuel[];
  openingRandom: RandomSource;
}> {
  return {
    humans: state.roster.humans,
    bots: state.roster.bots,
    duels: state.duels,
    openingRandom: state.openingRandom,
  };
}

function settleGloveHits(
  ending: EndingGloveResult,
  input: Readonly<{
    roster: Roster;
    duel: FightDuel;
    duels: FightDuel[];
    opener: HumanFighter;
    openingRandom: RandomSource;
  }>,
): EndingGloveResult {
  if (ending.selfKilled) return ending;
  const primary = settleAfterMobFell(ending.finished, input);
  const sideHits = ending.sideNotifies.map((notify) => {
    if (!input.roster.bots.some((bot) => bot.fightId === notify.targetId)) {
      return { notify, extra: [] as const };
    }
    const duel = requireDuelContaining(input.duels, notify.targetId);
    const owner = input.roster.humans.find((human) => duel.has(human.heroId));
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
  const bots = input.roster.bots.map((bot) => bot.snap());
  const patch = persChangeForParticipants(input.roster.humans, bots, [
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
  roster: Roster;
  duel: FightDuel;
  duels: FightDuel[];
  opener: HumanFighter;
  openingRandom: RandomSource;
}> {
  return {
    roster: state.roster,
    duel,
    duels: state.duels,
    opener: human,
    openingRandom: state.openingRandom,
  };
}
