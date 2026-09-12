import type { BattleEvent } from "./battle-event.ts";
import { huntBotSnap } from "./hunt-bot-snap.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
import { huntFightOpenerTeam } from "./hunt-fight-teams.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { FightDuel } from "./fight-duel.ts";
import { retargetDuelTo } from "./retarget-duel.ts";
import { planHuntShuffle, type ShuffleOutcome } from "./try-shuffle-after-hits.ts";

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
    (entry) => entry.waiting && !entry.leftLive && entry.hp > 0 && entry.team === team,
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
    hunt: HuntBattleInit;
    botHp: number;
    finished: boolean;
  }>,
): ShuffleOutcome {
  const actor = requirePaired(input.pairing);
  const openerTeam = huntFightOpenerTeam(input.hunt.purpose);
  const plan = planHuntShuffle({
    humanHits: input.pairing.duel.hitsFor(actor.heroId),
    botHits: input.pairing.duel.hitsFor(input.hunt.botFightId),
    hasLivingWaiter: livingWaiterOnTeam(input.pairing.humans, openerTeam) !== undefined,
    finished: input.finished || input.botHp === 0,
  });
  if (plan === "none") return { kind: "none" };
  if (plan === "reset") {
    input.pairing.duel.resetHits();
    return { kind: "reset" };
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
    events: waiter.authed
      ? [{ type: "opponent-new", bot: huntBotSnap(input.hunt, input.botHp) }]
      : [],
  };
}

export function pairNextHuntWaiter(
  input: Readonly<{
    pairing: HuntPairing;
    hunt: HuntBattleInit;
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
  const team = input.botHp > 0 ? huntFightOpenerTeam(input.hunt.purpose) : previous.team;
  const waiter = livingWaiterOnTeam(input.pairing.humans, team);
  if (!waiter) return null;
  retargetDuelTo({ duel: input.pairing.duel, fromHeroId: previous.heroId, waiter });
  input.pairing.pairedAccountId = waiter.accountId;
  if (!waiter.authed) return { accountId: waiter.accountId, authed: false, events: [] };
  if (input.botHp > 0) {
    return {
      accountId: waiter.accountId,
      authed: true,
      events: [{ type: "opponent-new", bot: huntBotSnap(input.hunt, input.botHp) }],
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

function requirePaired(pairing: HuntPairing): HuntHuman {
  const human = pairing.humans.find((entry) => entry.accountId === pairing.pairedAccountId);
  if (!human) throw new Error(`Human account ${pairing.pairedAccountId} is not in this battle`);
  return human;
}
