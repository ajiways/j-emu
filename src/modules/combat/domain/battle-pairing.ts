import type { BattleEvent } from "./battle-event.ts";
import { huntBotSnap } from "./hunt-bot-snap.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { HuntRosterBot } from "./hunt-roster-bot.ts";
import type { FightDuel } from "./fight-duel.ts";
import { peekWaitingEnemy, takeNextEnemyForHuman } from "./hunt-wait-queue.ts";
import { botMeleeTarget, humanMeleeTarget } from "./melee-target.ts";
import {
  PAIR_HITS_TO_SWITCH,
  planHuntShuffle,
  type ShuffleOutcome,
} from "./try-shuffle-after-hits.ts";
import { retargetDuelTo } from "./retarget-duel.ts";

export type HuntPairing = {
  duel: FightDuel;
  humans: HuntHuman[];
  pairedAccountId: number;
};

export function livingWaiterOnTeam(
  humans: readonly HuntHuman[],
  team: 1 | 2,
): HuntHuman | undefined {
  return humans.find(
    (entry) => entry.waiting && humanMeleeTarget(entry).alive && entry.team === team,
  );
}

export function huntHumanOppNew(human: HuntHuman): BattleEvent {
  return {
    type: "opponent-new-human",
    human: human.snapshot(),
    appearance: human.appearance,
  };
}

export function shuffleHuntAfterHits(
  input: Readonly<{
    pairing: HuntPairing;
    openerTeam: 1 | 2;
    enemyTeam: 1 | 2;
    bots: readonly HuntRosterBot[];
    duels: FightDuel[];
    finished: boolean;
  }>,
): ShuffleOutcome {
  const actor = requirePaired(input.pairing);
  const foeBot = input.bots.find((bot) => bot.fightId === input.pairing.duel.otherId(actor.heroId));
  if (!foeBot) return { kind: "none" };
  const openerTeam = input.openerTeam;
  const partner = otherHumanBotDuel(
    input.duels,
    input.pairing.duel,
    input.pairing.humans,
    input.bots,
  );
  const swappable =
    partner && partner.hitsA >= PAIR_HITS_TO_SWITCH && partner.hitsB >= PAIR_HITS_TO_SWITCH
      ? partner
      : null;
  const plan = planHuntShuffle({
    humanHits: input.pairing.duel.hitsFor(actor.heroId),
    botHits: input.pairing.duel.hitsFor(foeBot.fightId),
    hasLivingWaiter: livingWaiterOnTeam(input.pairing.humans, openerTeam) !== undefined,
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
    );
  }
  if (plan === "reserve-swap") {
    return applyReserveSwap(input.pairing, input.bots, input.enemyTeam, input.duels, actor, foeBot);
  }
  const waiter = livingWaiterOnTeam(input.pairing.humans, openerTeam);
  if (!waiter) throw new Error("Shuffle waiter-handoff requires a living waiter");
  const actorHp = actor.hp;
  const waiterHp = waiter.hp;
  actor.unpair();
  retargetDuelTo({ duel: input.pairing.duel, fromHeroId: actor.heroId, waiter });
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

export function pairNextHuntWaiter(
  input: Readonly<{
    pairing: HuntPairing;
    primary: HuntRosterBot;
    openerTeam: 1 | 2;
    enemyTeam: 1 | 2;
    botHp: number;
    finished: boolean;
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
  retargetDuelTo({ duel: input.pairing.duel, fromHeroId: previous.heroId, waiter });
  input.pairing.pairedAccountId = waiter.accountId;
  if (!waiter.authed) return { accountId: waiter.accountId, authed: false, events: [] };
  if (input.botHp > 0) {
    return {
      accountId: waiter.accountId,
      authed: true,
      events: [
        {
          type: "opponent-new",
          bot: huntBotSnap(input.primary, input.botHp, input.enemyTeam),
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
    events: [huntHumanOppNew(opponent)],
  };
}

function applyReserveSwap(
  pairing: HuntPairing,
  bots: readonly HuntRosterBot[],
  enemyTeam: 1 | 2,
  duels: FightDuel[],
  actor: HuntHuman,
  foeBot: HuntRosterBot,
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
  pairing.duel.setNextActor(actor.heroId);
  if (actor.hp !== actorHp || foeBot.hp !== foeHp || next.hp !== nextHp) {
    throw new Error("Shuffle must not change participant HP");
  }
  return { kind: "reserve-swap", accountId: actor.accountId, bot: next.snap() };
}

function applyCrossSwap(
  leftPairing: HuntPairing,
  other: FightDuel,
  humans: readonly HuntHuman[],
  bots: readonly HuntRosterBot[],
  actor: HuntHuman,
  actorBot: HuntRosterBot,
): ShuffleOutcome {
  const otherHuman = humans.find(
    (human) => other.has(human.heroId) && !human.waiting && humanMeleeTarget(human).alive,
  );
  if (!otherHuman) throw new Error("Shuffle cross-swap requires a living other human");
  const otherBot = bots.find((bot) => bot.fightId === other.otherId(otherHuman.heroId));
  if (!otherBot || !botMeleeTarget(otherBot).alive) {
    throw new Error("Shuffle cross-swap requires a living other bot");
  }
  const leftHp = actor.hp;
  const rightHp = otherHuman.hp;
  const leftBotHp = actorBot.hp;
  const rightBotHp = otherBot.hp;
  otherHuman.markFought(otherBot.fightId);
  otherBot.markFought(otherHuman.heroId);
  leftPairing.duel.replace(actorBot.fightId, otherBot.fightId);
  other.replace(otherBot.fightId, actorBot.fightId);
  leftPairing.duel.resetHits();
  other.resetHits();
  leftPairing.duel.setNextActor(actor.heroId);
  other.setNextActor(otherHuman.heroId);
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
    rightAccountId: otherHuman.accountId,
    leftBot: otherBot.snap(),
    rightBot: actorBot.snap(),
  };
}

function otherHumanBotDuel(
  duels: readonly FightDuel[],
  actorDuel: FightDuel,
  humans: readonly HuntHuman[],
  bots: readonly HuntRosterBot[],
): FightDuel | null {
  for (const duel of duels) {
    if (duel === actorDuel) continue;
    const human = humans.find(
      (entry) => duel.has(entry.heroId) && !entry.waiting && humanMeleeTarget(entry).alive,
    );
    if (!human) continue;
    const bot = bots.find((entry) => entry.fightId === duel.otherId(human.heroId));
    if (bot && botMeleeTarget(bot).alive) return duel;
  }
  return null;
}

function requirePaired(pairing: HuntPairing): HuntHuman {
  const human = pairing.humans.find((entry) => entry.accountId === pairing.pairedAccountId);
  if (!human) throw new Error(`Human account ${pairing.pairedAccountId} is not in this battle`);
  return human;
}
