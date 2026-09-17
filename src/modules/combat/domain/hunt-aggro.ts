import type { BattleEvent } from "./battle-event.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { HuntRoster } from "./hunt-roster.ts";
import type { RandomSource } from "./random-source.ts";
import type { HuntRosterBot } from "./hunt-roster-bot.ts";
import { pairHuntQueues } from "./try-pair-hunt-queues.ts";

export type HuntAggroResult =
  | Readonly<{ kind: "ignored" }>
  | Readonly<{
      kind: "resolved";
      events: readonly BattleEvent[];
      pairedAccountIds: readonly number[];
    }>;

export function tryHuntAggro(
  input: Readonly<{
    kind: "hunt" | "friendly-duel" | "pvp";
    purpose: "hunt" | "quest" | "friendly-duel" | "pvp";
    instanceCopyId: number | null;
    finished: boolean;
    humans: readonly HuntHuman[];
    duels: FightDuel[];
    roster: HuntRoster | null;
    random: RandomSource;
    accountId: number;
    targetId: number;
    allocateBotId: () => number;
  }>,
): HuntAggroResult {
  const human = input.humans.find((entry) => entry.accountId === input.accountId);
  if (!human || !human.authed || human.hp === 0 || input.finished) {
    return { kind: "ignored" };
  }
  const deny = (): HuntAggroResult => ({
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
  if (
    input.kind !== "hunt" ||
    input.purpose !== "hunt" ||
    input.instanceCopyId !== null ||
    !input.roster
  ) {
    return deny();
  }
  if (human.casts.aggro < 1) return deny();
  const source = aggroSourceBot(human, input.roster, input.targetId);
  if (!source) return deny();
  const waitingBefore = new Set(
    input.humans.filter((entry) => entry.waiting).map((entry) => entry.accountId),
  );
  const count = human.casts.spendAggro();
  const clone = input.roster.enqueueAggroClone(source.fightId, input.allocateBotId());
  pairHuntQueues({
    humans: input.humans,
    duels: input.duels,
    roster: input.roster,
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
        rosterBots: input.roster.snaps(),
      },
    ],
  };
}

function aggroSourceBot(
  human: HuntHuman,
  roster: HuntRoster,
  targetId: number,
): HuntRosterBot | null {
  if (!Number.isInteger(targetId) || targetId < 1) {
    throw new Error("Hunt aggro target id must be a positive integer");
  }
  const bot = roster.findBot(targetId);
  if (!bot || bot.team === human.team) return null;
  return bot;
}
