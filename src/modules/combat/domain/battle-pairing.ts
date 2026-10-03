import type { BattleEvent } from "./battle-event.ts";
import { botSnapOf } from "./bot-snap-of.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { BotFighter } from "./bot-fighter.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { RandomSource } from "./random-source.ts";
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

export function humanOpponentNew(human: HumanFighter): BattleEvent {
  return {
    type: "opponent-new-human",
    human: human.snapshot(),
    appearance: human.appearance,
  };
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

function requirePaired(pairing: DuelPairing): HumanFighter {
  const human = pairing.humans.find((entry) => entry.accountId === pairing.pairedAccountId);
  if (!human) throw new Error(`Human account ${pairing.pairedAccountId} is not in this battle`);
  return human;
}

function requireBotById(bot: BotFighter, id: number): BotFighter {
  if (bot.fightId !== id) throw new Error(`The side ${id} that stays in the duel is unknown`);
  return bot;
}
