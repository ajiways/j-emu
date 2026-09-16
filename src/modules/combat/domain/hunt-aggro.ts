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
    allocateBotId: () => number;
  }>,
): HuntAggroResult {
  const human = input.humans.find((entry) => entry.accountId === input.accountId);
  if (!human || !human.authed || human.waiting || human.hp === 0 || input.finished) {
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
        loadout: human.casts.loadout,
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
  const source = aggroSourceBot(human, input.duels, input.roster);
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
        loadout: human.casts.loadout,
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
  duels: readonly FightDuel[],
  roster: HuntRoster,
): HuntRosterBot | null {
  const duel = duels.find((entry) => entry.has(human.heroId));
  if (!duel) return null;
  const bot = roster.findBot(duel.otherId(human.heroId));
  if (!bot || bot.team === human.team || bot.hp === 0) return null;
  return bot;
}
