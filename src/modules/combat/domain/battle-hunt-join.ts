import type { BattleEvent } from "./battle-event.ts";
import { seedJoiner } from "./battle-fighters.ts";
import { primaryEnemyBot } from "./fight-bots.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { FightEffectIds } from "./fight-effect-ids.ts";
import type { FightRules } from "./fight-rules.ts";
import { huntBotSnap } from "./hunt-bot-snap.ts";
import type { FightSetupJoin } from "./fight-setup.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { HuntRosterBot } from "./hunt-roster-bot.ts";
import type { RandomSource } from "./random-source.ts";
import { requireFightSetupJoin } from "./require-fight-setup.ts";
import { pairHuntQueues } from "./try-pair-hunt-queues.ts";

export function huntHistoryOf(opener: HuntHuman, primary: HuntRosterBot) {
  return {
    accountId: opener.accountId,
    heroId: opener.heroId,
    heroNick: opener.nick,
    heroLevel: opener.level,
    heroKind: opener.kind,
    botArtikulId: primary.artikulId,
    botNick: primary.nick,
    botLevel: primary.level,
  };
}

export function joinBattleHuman(input: {
  fightRules: FightRules;
  finished: boolean;
  humans: HuntHuman[];
  bots: HuntRosterBot[];
  enemyTeam: 1 | 2;
  join: FightSetupJoin;
  hasHuman: (accountId: number, heroId: number) => boolean;
  duels: FightDuel[];
  random: RandomSource;
  effectIds: FightEffectIds;
}): BattleEvent {
  requireFightSetupJoin(input.join);
  const join = input.fightRules.humanJoin;
  if (join.mode === "denied") {
    throw new Error(join.reason);
  }
  const roster =
    join.mode === "pvp-humans"
      ? addPvpHuman({
          finished: input.finished,
          humans: input.humans,
          join: input.join,
          hasHuman: input.hasHuman,
          effectIds: input.effectIds,
        })
      : join.mode === "hunt-roster"
        ? addHuntHuman({
            finished: input.finished,
            humans: input.humans,
            bots: input.bots,
            enemyTeam: input.enemyTeam,
            join: input.join,
            hasHuman: input.hasHuman,
            effectIds: input.effectIds,
          })
        : (() => {
            throw new Error(
              `Unknown human join mode: ${String((join as { mode?: unknown }).mode)}`,
            );
          })();
  pairHuntQueues({
    humans: input.humans,
    duels: input.duels,
    bots: input.bots,
    random: input.random,
  });
  return roster;
}

function addHuntHuman(input: {
  finished: boolean;
  humans: HuntHuman[];
  bots: readonly HuntRosterBot[];
  enemyTeam: 1 | 2;
  join: FightSetupJoin;
  hasHuman: (accountId: number, heroId: number) => boolean;
  effectIds: FightEffectIds;
}): BattleEvent {
  if (input.finished) throw new Error("Cannot join a finished battle");
  if (input.hasHuman(input.join.accountId, input.join.heroId)) {
    throw new Error("Human is already in this battle");
  }
  if (input.bots.some((bot) => bot.fightId === input.join.heroId)) {
    throw new Error("Fight bot id collides with the human participant id");
  }
  const human = seedJoiner(input.join, input.effectIds);
  input.humans.push(human);
  const primary = primaryEnemyBot(input.bots, input.enemyTeam);
  return {
    type: "roster-updated",
    humans: input.humans.map((entry) => entry.snapshot()),
    bot: huntBotSnap(primary, primary.hp, input.enemyTeam),
    joined: human.snapshot(),
  };
}

function addPvpHuman(input: {
  finished: boolean;
  humans: HuntHuman[];
  join: FightSetupJoin;
  hasHuman: (accountId: number, heroId: number) => boolean;
  effectIds: FightEffectIds;
}): BattleEvent {
  if (input.finished) throw new Error("Cannot join a finished battle");
  if (input.hasHuman(input.join.accountId, input.join.heroId)) {
    throw new Error("Human is already in this battle");
  }
  const human = seedJoiner(input.join, input.effectIds);
  input.humans.push(human);
  return {
    type: "roster-updated",
    humans: input.humans.map((entry) => entry.snapshot()),
    joined: human.snapshot(),
    rosterBots: [],
  };
}
