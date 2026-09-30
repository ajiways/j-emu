import type { Roster } from "./roster.ts";
import type { BattleEvent } from "./battle-event.ts";
import { seedJoiner } from "./battle-fighters.ts";
import { primaryEnemyBot } from "./fight-bots.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { FightEffectIds } from "./fight-effect-ids.ts";
import type { FightRules } from "./fight-rules.ts";
import { botSnapOf } from "./bot-snap-of.ts";
import type { FightSetupJoin } from "./fight-setup.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { BotFighter } from "./bot-fighter.ts";
import type { RandomSource } from "./random-source.ts";
import { requireFightSetupJoin } from "./require-fight-setup.ts";
import { pairQueues } from "./pairing.ts";

export function historyOf(opener: HumanFighter, primary: BotFighter) {
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
  roster: Roster;
  enemyTeam: 1 | 2;
  join: FightSetupJoin;
  hasHuman: (accountId: number, heroId: number) => boolean;
  add: (participant: HumanFighter) => void;
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
          roster: input.roster,
          add: input.add,
          join: input.join,
          hasHuman: input.hasHuman,
          effectIds: input.effectIds,
        })
      : join.mode === "hunt-roster"
        ? addHuntHuman({
            finished: input.finished,
            roster: input.roster,
            add: input.add,
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
  pairQueues({
    participants: input.roster.all(),
    duels: input.duels,
    random: input.random,
  });
  return roster;
}

function addHuntHuman(input: {
  finished: boolean;
  roster: Roster;
  add: (participant: HumanFighter) => void;
  enemyTeam: 1 | 2;
  join: FightSetupJoin;
  hasHuman: (accountId: number, heroId: number) => boolean;
  effectIds: FightEffectIds;
}): BattleEvent {
  if (input.finished) throw new Error("Cannot join a finished battle");
  if (input.hasHuman(input.join.accountId, input.join.heroId)) {
    throw new Error("Human is already in this battle");
  }
  if (input.roster.bots.some((bot) => bot.fightId === input.join.heroId)) {
    throw new Error("Fight bot id collides with the human participant id");
  }
  const human = seedJoiner(input.join, input.effectIds);
  input.add(human);
  const primary = primaryEnemyBot(input.roster.bots, input.enemyTeam);
  return {
    type: "roster-updated",
    humans: input.roster.humans.map((entry) => entry.snapshot()),
    bot: botSnapOf(primary, primary.hp, input.enemyTeam),
    joined: human.snapshot(),
  };
}

function addPvpHuman(input: {
  finished: boolean;
  roster: Roster;
  add: (participant: HumanFighter) => void;
  join: FightSetupJoin;
  hasHuman: (accountId: number, heroId: number) => boolean;
  effectIds: FightEffectIds;
}): BattleEvent {
  if (input.finished) throw new Error("Cannot join a finished battle");
  if (input.hasHuman(input.join.accountId, input.join.heroId)) {
    throw new Error("Human is already in this battle");
  }
  const human = seedJoiner(input.join, input.effectIds);
  input.add(human);
  return {
    type: "roster-updated",
    humans: input.roster.humans.map((entry) => entry.snapshot()),
    joined: human.snapshot(),
    rosterBots: [],
  };
}
