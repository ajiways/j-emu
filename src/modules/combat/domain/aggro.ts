import type { BattleEvent } from "./battle-event.ts";
import { enqueueAggroClone } from "./fight-bots.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { BotFighter } from "./bot-fighter.ts";
import type { RandomSource } from "./random-source.ts";
import { pairQueues } from "./pairing.ts";

export type AggroResult =
  | Readonly<{ kind: "ignored" }>
  | Readonly<{
      kind: "resolved";
      events: readonly BattleEvent[];
      pairedAccountIds: readonly number[];
    }>;

export function tryAggro(
  input: Readonly<{
    canAggro: boolean;
    finished: boolean;
    humans: readonly HumanFighter[];
    duels: FightDuel[];
    bots: readonly BotFighter[];
    addBot: (bot: BotFighter) => void;
    enemyTeam: 1 | 2;
    random: RandomSource;
    accountId: number;
    targetId: number;
    allocateBotId: () => number;
  }>,
): AggroResult {
  const human = input.humans.find((entry) => entry.accountId === input.accountId);
  if (!human || !human.authed || human.hp === 0 || input.finished) {
    return { kind: "ignored" };
  }
  const deny = (): AggroResult => ({
    kind: "resolved",
    pairedAccountIds: [],
    events: [
      {
        type: "buff-cast",
        animation: "fury",
        sourceId: human.heroId,
        targetId: human.heroId,
        maxHp: human.maxHp,
      },
      {
        type: "native-count",
        srcId: 7,
        count: human.casts.aggro,
        title: "Разозлить",
        loadout: human.casts.wireLoadout(),
      },
    ],
  });
  if (!input.canAggro) {
    return deny();
  }
  if (human.casts.aggro < 1) return deny();
  const source = aggroSourceBot(human, input.bots, input.targetId);
  if (!source) return deny();
  const waitingBefore = new Set(
    input.humans.filter((entry) => entry.waiting).map((entry) => entry.accountId),
  );
  const count = human.casts.spendAggro();
  const clone = enqueueAggroClone(
    input.bots,
    source.fightId,
    input.allocateBotId(),
    input.enemyTeam,
    input.addBot,
  );
  pairQueues({
    participants: [...input.humans, ...input.bots],
    duels: input.duels,
    random: input.random,
  });
  const pairedAccountIds = input.humans
    .filter((entry) => waitingBefore.has(entry.accountId) && !entry.waiting)
    .map((entry) => entry.accountId);
  return {
    kind: "resolved",
    pairedAccountIds,
    events: [
      {
        type: "native-count",
        srcId: 7,
        count,
        title: "Разозлить",
        loadout: human.casts.wireLoadout(),
      },
      {
        type: "roster-updated",
        humans: input.humans.map((entry) => entry.snapshot()),
        bot: clone.snap(),
        joined: human.snapshot(),
        rosterBots: input.bots.map((bot) => bot.snap()),
      },
    ],
  };
}

function aggroSourceBot(
  human: HumanFighter,
  bots: readonly BotFighter[],
  targetId: number,
): BotFighter | null {
  if (!Number.isInteger(targetId) || targetId < 1) {
    throw new Error("Hunt aggro target id must be a positive integer");
  }
  const bot = bots.find((entry) => entry.fightId === targetId);
  if (!bot || bot.team === human.team) return null;
  return bot;
}
