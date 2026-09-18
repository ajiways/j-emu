import type { BattleEvent } from "./battle-event.ts";
import { huntJoiner } from "./battle-fighters.ts";
import { requireBattleHuntRoster, requireHuntInit } from "./battle-lookups.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { FightEffectIds } from "./fight-effect-ids.ts";
import type { FightRules } from "./fight-rules.ts";
import { huntBotSnap } from "./hunt-bot-snap.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
import type { FriendlyDuelBattleInit } from "./friendly-duel-battle-init.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { HuntJoinHuman } from "./hunt-join-human.ts";
import type { HuntRoster } from "./hunt-roster.ts";
import type { RandomSource } from "./random-source.ts";
import { pairHuntQueues } from "./try-pair-hunt-queues.ts";

export function huntHistoryOf(opener: HuntHuman, hunt: HuntBattleInit) {
  return {
    accountId: opener.accountId,
    heroId: opener.heroId,
    heroNick: opener.nick,
    heroLevel: opener.level,
    heroKind: opener.kind,
    botArtikulId: hunt.botArtikulId,
    botNick: hunt.botNick,
    botLevel: hunt.botLevel,
  };
}

export function joinBattleHuman(input: {
  fightRules: FightRules;
  finished: boolean;
  humans: HuntHuman[];
  huntRoster: HuntRoster | null;
  init: HuntBattleInit | FriendlyDuelBattleInit;
  join: HuntJoinHuman;
  hasHuman: (accountId: number, heroId: number) => boolean;
  duels: FightDuel[];
  random: RandomSource;
  effectIds: FightEffectIds;
}): BattleEvent {
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
            roster: requireBattleHuntRoster(input.huntRoster),
            hunt: requireHuntInit(input.init),
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
    roster: input.huntRoster,
    random: input.random,
  });
  return roster;
}

function addHuntHuman(input: {
  finished: boolean;
  humans: HuntHuman[];
  roster: HuntRoster;
  hunt: HuntBattleInit;
  join: HuntJoinHuman;
  hasHuman: (accountId: number, heroId: number) => boolean;
  effectIds: FightEffectIds;
}): BattleEvent {
  if (input.finished) throw new Error("Cannot join a finished battle");
  if (input.hasHuman(input.join.accountId, input.join.heroId)) {
    throw new Error("Human is already in this battle");
  }
  if (input.roster.snaps().some((bot) => bot.id === input.join.heroId)) {
    throw new Error("Fight bot id collides with the human participant id");
  }
  const human = huntJoiner(input.join, input.effectIds);
  input.humans.push(human);
  return {
    type: "roster-updated",
    humans: input.humans.map((entry) => entry.snapshot()),
    bot: huntBotSnap(input.hunt, input.roster.primary.hp, input.roster.enemyTeam),
    joined: human.snapshot(),
  };
}

function addPvpHuman(input: {
  finished: boolean;
  humans: HuntHuman[];
  join: HuntJoinHuman;
  hasHuman: (accountId: number, heroId: number) => boolean;
  effectIds: FightEffectIds;
}): BattleEvent {
  if (input.finished) throw new Error("Cannot join a finished battle");
  if (input.hasHuman(input.join.accountId, input.join.heroId)) {
    throw new Error("Human is already in this battle");
  }
  const human = huntJoiner(input.join, input.effectIds);
  input.humans.push(human);
  return {
    type: "roster-updated",
    humans: input.humans.map((entry) => entry.snapshot()),
    joined: human.snapshot(),
    rosterBots: [],
  };
}
