import type { HuntHuman } from "./hunt-human.ts";

export function practiceHistoryOf(humans: readonly HuntHuman[]) {
  if (humans.length !== 2) {
    throw new Error("Practice history requires exactly two humans");
  }
  const challenger = humans.find((human) => human.team === 1);
  const acceptor = humans.find((human) => human.team === 2);
  if (!challenger || !acceptor) {
    throw new Error("Practice history requires one human on each team");
  }
  return {
    accountId: challenger.accountId,
    heroId: challenger.heroId,
    challengerId: challenger.heroId,
    challengerNick: challenger.nick,
    challengerLevel: challenger.level,
    challengerKind: challenger.kind,
    challengerDead: challenger.hp <= 0,
    challengerFlee: (challenger.leftLive ? 1 : 0) as 0 | 1,
    acceptorId: acceptor.heroId,
    acceptorNick: acceptor.nick,
    acceptorLevel: acceptor.level,
    acceptorKind: acceptor.kind,
    acceptorDead: acceptor.hp <= 0,
    acceptorFlee: (acceptor.leftLive ? 1 : 0) as 0 | 1,
  };
}
