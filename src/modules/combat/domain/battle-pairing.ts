import type { BattleEvent } from "./battle-event.ts";
import { botSnapOf } from "./bot-snap-of.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { Participant } from "./participant.ts";
import type { BotFighter } from "./bot-fighter.ts";
import type { FightDuel } from "./fight-duel.ts";
import { peekWaitingEnemy, takeNextEnemyForHuman } from "./wait-queue.ts";
import { PAIR_HITS_TO_SWITCH, planShuffle, type ShuffleOutcome } from "./try-shuffle-after-hits.ts";
import type { RandomSource } from "./random-source.ts";
import { rollDuelOpener } from "./roll-duel-opener.ts";
import { retargetDuelTo } from "./retarget-duel.ts";

export type DuelPairing = {
  duel: FightDuel;
  humans: HumanFighter[];
  pairedAccountId: number;
};

export function livingWaiterOnTeam(
  humans: readonly HumanFighter[],
  team: 1 | 2,
): HumanFighter | undefined {
  return humans.find((entry) => entry.waiting && entry.alive && entry.team === team);
}

/** A mob of `team` that waits for a foe: an ally who may take over a duel. */
function livingBotWaiterOnTeam(bots: readonly BotFighter[], team: 1 | 2): BotFighter | undefined {
  return bots.find((entry) => entry.waiting && entry.alive && entry.team === team);
}

export function humanOpponentNew(human: HumanFighter): BattleEvent {
  return {
    type: "opponent-new-human",
    human: human.snapshot(),
    appearance: human.appearance,
  };
}

export function shuffleAfterHits(
  input: Readonly<{
    pairing: DuelPairing;
    openerTeam: 1 | 2;
    enemyTeam: 1 | 2;
    bots: readonly BotFighter[];
    duels: FightDuel[];
    finished: boolean;
    openingRandom: RandomSource;
  }>,
): ShuffleOutcome {
  const actor = requirePaired(input.pairing);
  const foeBot = input.bots.find((bot) => bot.fightId === input.pairing.duel.otherId(actor.heroId));
  if (!foeBot) return { kind: "none" };
  const openerTeam = input.openerTeam;
  const partner = otherAllyDuel(
    input.duels,
    input.pairing.duel,
    input.pairing.humans,
    input.bots,
    actor.team,
  );
  const swappable =
    partner && partner.hitsA >= PAIR_HITS_TO_SWITCH && partner.hitsB >= PAIR_HITS_TO_SWITCH
      ? partner
      : null;
  const plan = planShuffle({
    humanHits: input.pairing.duel.hitsFor(actor.heroId),
    botHits: input.pairing.duel.hitsFor(foeBot.fightId),
    hasLivingWaiter:
      livingWaiterOnTeam(input.pairing.humans, openerTeam) !== undefined ||
      livingBotWaiterOnTeam(input.bots, openerTeam) !== undefined,
    hasSwappableOther: swappable !== null,
    hasLivingReserve: peekWaitingEnemy(input.bots, input.enemyTeam) !== null,
    finished: input.finished || foeBot.hp === 0,
  });
  if (plan === "none") return { kind: "none" };
  actor.markFought(foeBot.fightId);
  foeBot.markFought(actor.heroId);
  if (plan === "cross-swap") {
    if (!swappable) throw new Error("Shuffle cross-swap requires another 3↔3 duel");
    return applyCrossSwap(
      input.pairing,
      swappable,
      input.pairing.humans,
      input.bots,
      actor,
      foeBot,
      input.openingRandom,
    );
  }
  if (plan === "reserve-swap") {
    return applyReserveSwap(
      input.pairing,
      input.bots,
      input.enemyTeam,
      input.duels,
      actor,
      foeBot,
      input.openingRandom,
    );
  }
  const waiter = livingWaiterOnTeam(input.pairing.humans, openerTeam);
  if (!waiter) return handOffToAllyBot(input, actor, foeBot, openerTeam);
  const actorHp = actor.hp;
  const waiterHp = waiter.hp;
  actor.unpair();
  retargetDuelTo({
    duel: input.pairing.duel,
    fromHeroId: actor.heroId,
    waiter,
    other: foeBot,
    openingRandom: input.openingRandom,
  });
  input.pairing.pairedAccountId = waiter.accountId;
  if (actor.hp !== actorHp || waiter.hp !== waiterHp) {
    throw new Error("Shuffle must not change participant HP");
  }
  return {
    kind: "waiter-handoff",
    actorAccountId: actor.accountId,
    waiterAccountId: waiter.accountId,
    waiterAuthed: waiter.authed,
    events: waiter.authed ? [{ type: "opponent-new", bot: foeBot.snap() }] : [],
  };
}

/** The duel goes on between the foe and a waiting ally mob; the hero steps out and waits. */
function handOffToAllyBot(
  input: Readonly<{
    pairing: DuelPairing;
    bots: readonly BotFighter[];
    openingRandom: RandomSource;
  }>,
  actor: HumanFighter,
  foeBot: BotFighter,
  team: 1 | 2,
): ShuffleOutcome {
  const ally = livingBotWaiterOnTeam(input.bots, team);
  if (!ally) throw new Error("Shuffle waiter-handoff requires a living waiter");
  const hp = [actor.hp, foeBot.hp, ally.hp];
  actor.unpair();
  ally.pair();
  input.pairing.duel.replace(actor.heroId, ally.fightId);
  input.pairing.duel.resetHits();
  rollDuelOpener(input.pairing.duel, {
    holder: ally,
    other: foeBot,
    random: input.openingRandom,
  });
  if (actor.hp !== hp[0] || foeBot.hp !== hp[1] || ally.hp !== hp[2]) {
    throw new Error("Shuffle must not change participant HP");
  }
  return { kind: "ally-handoff", actorAccountId: actor.accountId };
}

export function pairNextWaiter(
  input: Readonly<{
    pairing: DuelPairing;
    primary: BotFighter;
    openerTeam: 1 | 2;
    enemyTeam: 1 | 2;
    botHp: number;
    finished: boolean;
    openingRandom: RandomSource;
  }>,
): Readonly<{
  accountId: number;
  authed: boolean;
  events: readonly BattleEvent[];
}> | null {
  if (input.finished) return null;
  const previous = requirePaired(input.pairing);
  const team = input.botHp > 0 ? input.openerTeam : previous.team;
  const waiter = livingWaiterOnTeam(input.pairing.humans, team);
  if (!waiter) return null;
  const stays = input.pairing.duel.otherId(previous.heroId);
  retargetDuelTo({
    duel: input.pairing.duel,
    fromHeroId: previous.heroId,
    waiter,
    other:
      input.pairing.humans.find((entry) => entry.heroId === stays) ??
      requireBotById(input.primary, stays),
    openingRandom: input.openingRandom,
  });
  input.pairing.pairedAccountId = waiter.accountId;
  if (!waiter.authed) return { accountId: waiter.accountId, authed: false, events: [] };
  if (input.botHp > 0) {
    return {
      accountId: waiter.accountId,
      authed: true,
      events: [
        {
          type: "opponent-new",
          bot: botSnapOf(input.primary, input.botHp, input.enemyTeam),
        },
      ],
    };
  }
  const opponentId = input.pairing.duel.otherId(waiter.heroId);
  const opponent = input.pairing.humans.find((entry) => entry.heroId === opponentId);
  if (!opponent) throw new Error("Intervene waiter has no human opponent");
  return {
    accountId: waiter.accountId,
    authed: true,
    events: [humanOpponentNew(opponent)],
  };
}

function applyReserveSwap(
  pairing: DuelPairing,
  bots: readonly BotFighter[],
  enemyTeam: 1 | 2,
  duels: FightDuel[],
  actor: HumanFighter,
  foeBot: BotFighter,
  openingRandom: RandomSource,
): ShuffleOutcome {
  const reserve = peekWaitingEnemy(bots, enemyTeam);
  if (!reserve) throw new Error("Shuffle reserve-swap requires a waiting enemy");
  const next = takeNextEnemyForHuman({
    bots,
    enemyTeam,
    duels,
    occupiedFightId: foeBot.fightId,
  });
  if (!next || next.fightId !== reserve.fightId) {
    throw new Error("Shuffle reserve-swap did not take the waiting enemy");
  }
  const actorHp = actor.hp;
  const foeHp = foeBot.hp;
  const nextHp = next.hp;
  foeBot.unpair();
  pairing.duel.replace(foeBot.fightId, next.fightId);
  pairing.duel.resetHits();
  rollDuelOpener(pairing.duel, { holder: actor, other: next, random: openingRandom });
  if (actor.hp !== actorHp || foeBot.hp !== foeHp || next.hp !== nextHp) {
    throw new Error("Shuffle must not change participant HP");
  }
  return { kind: "reserve-swap", accountId: actor.accountId, bot: next.snap() };
}

function applyCrossSwap(
  leftPairing: DuelPairing,
  other: FightDuel,
  humans: readonly HumanFighter[],
  bots: readonly BotFighter[],
  actor: HumanFighter,
  actorBot: BotFighter,
  openingRandom: RandomSource,
): ShuffleOutcome {
  const otherHuman = livingAllyIn(other, humans, bots, actor.team);
  if (!otherHuman) throw new Error("Shuffle cross-swap requires a living other ally");
  const otherBot = bots.find((bot) => bot.fightId === other.otherId(otherHuman.id));
  if (!otherBot || !otherBot.alive) {
    throw new Error("Shuffle cross-swap requires a living other bot");
  }
  const leftHp = actor.hp;
  const rightHp = otherHuman.hp;
  const leftBotHp = actorBot.hp;
  const rightBotHp = otherBot.hp;
  otherHuman.markFought(otherBot.fightId);
  otherBot.markFought(otherHuman.id);
  leftPairing.duel.replace(actorBot.fightId, otherBot.fightId);
  other.replace(otherBot.fightId, actorBot.fightId);
  leftPairing.duel.resetHits();
  other.resetHits();
  rollDuelOpener(leftPairing.duel, { holder: actor, other: otherBot, random: openingRandom });
  rollDuelOpener(other, { holder: otherHuman, other: actorBot, random: openingRandom });
  if (
    actor.hp !== leftHp ||
    otherHuman.hp !== rightHp ||
    actorBot.hp !== leftBotHp ||
    otherBot.hp !== rightBotHp
  ) {
    throw new Error("Shuffle must not change participant HP");
  }
  return {
    kind: "cross-swap",
    leftAccountId: actor.accountId,
    rightAccountId: otherHuman.fighterKind === "human" ? humanAccountOf(humans, otherHuman) : null,
    leftBot: otherBot.snap(),
    rightBot: actorBot.snap(),
  };
}

/** The living, fighting ally of `team` (a player or a mob) who stands in `duel` against a mob. */
function humanAccountOf(humans: readonly HumanFighter[], participant: Participant): number {
  const human = humans.find((entry) => entry.id === participant.id);
  if (!human) throw new Error(`Participant ${participant.id} is not a player`);
  return human.accountId;
}

function livingAllyIn(
  duel: FightDuel,
  humans: readonly HumanFighter[],
  bots: readonly BotFighter[],
  team: 1 | 2,
): Participant | undefined {
  const ally = [...humans, ...bots].find(
    (entry) => entry.team === team && duel.has(entry.id) && !entry.waiting && entry.alive,
  );
  if (!ally) return undefined;
  const foe = bots.find((entry) => entry.fightId === duel.otherId(ally.id));
  return foe?.alive && foe.team !== team ? ally : undefined;
}

/** Another duel of an ally of `team` against a mob: the one an actor may swap foes with. */
function otherAllyDuel(
  duels: readonly FightDuel[],
  actorDuel: FightDuel,
  humans: readonly HumanFighter[],
  bots: readonly BotFighter[],
  team: 1 | 2,
): FightDuel | null {
  return (
    duels.find(
      (duel) => duel !== actorDuel && livingAllyIn(duel, humans, bots, team) !== undefined,
    ) ?? null
  );
}

function requirePaired(pairing: DuelPairing): HumanFighter {
  const human = pairing.humans.find((entry) => entry.accountId === pairing.pairedAccountId);
  if (!human) throw new Error(`Human account ${pairing.pairedAccountId} is not in this battle`);
  return human;
}

function requireBotById(bot: BotFighter, id: number): BotFighter {
  if (bot.fightId !== id) throw new Error(`The side ${id} that stays in the duel is unknown`);
  return bot;
}
