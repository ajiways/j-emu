import type { BattleEvent } from "./battle-event.ts";
import { huntJoiner } from "./battle-fighters.ts";
import { huntBotSnap } from "./hunt-bot-snap.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { HuntJoinHuman } from "./hunt-join-human.ts";
import type { HuntRoster } from "./hunt-roster.ts";

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

export function addHuntHuman(input: {
  kind: "hunt" | "friendly-duel" | "pvp";
  finished: boolean;
  humans: HuntHuman[];
  roster: HuntRoster;
  hunt: HuntBattleInit;
  join: HuntJoinHuman;
  hasHuman: (accountId: number, heroId: number) => boolean;
}): BattleEvent {
  if (input.kind !== "hunt") throw new Error("Cannot join a friendly duel");
  if (input.finished) throw new Error("Cannot join a finished battle");
  if (input.hasHuman(input.join.accountId, input.join.heroId)) {
    throw new Error("Human is already in this battle");
  }
  if (input.roster.snaps().some((bot) => bot.id === input.join.heroId)) {
    throw new Error("Fight bot id collides with the human participant id");
  }
  const human = huntJoiner(input.join);
  input.humans.push(human);
  return {
    type: "roster-updated",
    humans: input.humans.map((entry) => entry.snapshot()),
    bot: huntBotSnap(input.hunt, input.roster.primary.hp),
    joined: human.snapshot(),
  };
}
