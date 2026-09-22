import { fightStartedLabel } from "./fight-started-label.ts";
import type { FightLootBlock } from "./fight-loot-block.ts";
import type { HuntBotSnap } from "./battle-event.ts";
import type { FightKind } from "./fight-rules.ts";

type FightResultType = "1" | "6";

export function wireFightTypeOf(kind: FightKind): FightResultType {
  if (kind === "friendly-duel") return "6";
  if (kind === "hunt" || kind === "quest" || kind === "pvp") return "1";
  throw new Error(`Unknown fight kind: ${String(kind)}`);
}

type FightResultUser = Readonly<{
  participantId: number;
  id: string;
  bot: boolean;
  artikulId: number;
  team: 1 | 2;
  nick: string;
  money: number;
  level: number;
  kind: number;
  flee: boolean;
  loot: number;
  injury: 0 | "1";
  killCount: number;
  exp: number;
  honor: number;
  dmg: number;
  heal: number;
  dead: boolean;
  offline: 0 | 1;
  hp: number;
  mp: number;
  hpMax: number;
  mpMax: number;
}>;

export type FightResultInfo = Readonly<{
  fightId: string;
  title: string;
  type: FightResultType;
  started: string;
  duration: string;
  timeout: number;
  areaId: string;
  finished: 0 | 1;
  winnerTeam: "1" | "2";
  users: readonly FightResultUser[];
}>;

export type FightResultHumanInput = Readonly<{
  accountId: number;
  heroId: number;
  nick: string;
  level: number;
  kind: number;
  team: 1 | 2;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  damageToBot: number;
  damageToHumans: number;
  leftLive: boolean;
}>;

export function buildFightResultInfo(input: {
  fightId: string;
  title: string;
  type: FightResultType;
  areaId: string;
  timeout: number;
  startedAt: Date;
  now: Date;
  winnerTeam: 1 | 2;
  humans: readonly FightResultHumanInput[];
  bots: readonly HuntBotSnap[];
  lootByAccount: ReadonlyMap<number, FightLootBlock>;
}): FightResultInfo {
  if (!input.fightId) throw new Error("Fight result requires a fight id");
  if (!input.title) throw new Error("Fight result requires a title");
  if (!input.areaId) throw new Error("Fight result requires an area id");
  if (!Number.isInteger(input.timeout) || input.timeout < 1) {
    throw new Error("Fight result timeout must be a positive integer");
  }
  if (input.humans.length === 0) throw new Error("Fight result requires a human");
  const durationSec = Math.max(
    1,
    Math.floor((input.now.getTime() - input.startedAt.getTime()) / 1000),
  );
  const allFled = input.humans.every((human) => human.leftLive);
  const enemyDead = input.bots.some((bot) => bot.hp <= 0);
  const users: FightResultUser[] = [];
  for (const human of input.humans) {
    const loot = input.lootByAccount.get(human.accountId);
    users.push({
      participantId: human.heroId,
      id: String(human.heroId),
      bot: false,
      artikulId: 0,
      team: human.team,
      nick: human.nick,
      money: lootMoney(loot),
      level: human.level,
      kind: human.kind,
      flee: human.leftLive,
      loot: lootItemCount(loot),
      injury: 0,
      killCount: input.winnerTeam === human.team && enemyDead && !human.leftLive ? 1 : 0,
      exp: loot?.experience ?? 0,
      honor: 0,
      dmg: human.damageToBot + human.damageToHumans,
      heal: 0,
      dead: human.hp <= 0,
      offline: 1,
      hp: human.hp,
      mp: human.mp,
      hpMax: human.maxHp,
      mpMax: human.maxMp,
    });
  }
  for (const bot of input.bots) {
    users.push({
      participantId: bot.id,
      id: String(bot.artikulId),
      bot: true,
      artikulId: bot.artikulId,
      team: bot.team,
      nick: bot.nick,
      money: 0,
      level: bot.level,
      kind: 0,
      flee: false,
      loot: 0,
      injury: 0,
      killCount: 0,
      exp: 0,
      honor: 0,
      dmg: bot.dealtDamage,
      heal: 0,
      dead: bot.hp <= 0,
      offline: 0,
      hp: bot.hp,
      mp: 0,
      hpMax: bot.maxHp,
      mpMax: 0,
    });
  }
  return {
    fightId: input.fightId,
    title: input.title,
    type: input.type,
    started: fightStartedLabel(input.startedAt),
    duration: String(durationSec),
    timeout: input.timeout,
    areaId: input.areaId,
    finished: allFled ? 0 : 1,
    winnerTeam: input.winnerTeam === 1 ? "1" : "2",
    users,
  };
}

function lootMoney(loot: FightLootBlock | undefined): number {
  if (!loot) return 0;
  const amount = Number(loot.money);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Fight loot money is invalid");
  return amount;
}

function lootItemCount(loot: FightLootBlock | undefined): number {
  if (!loot || Array.isArray(loot.loot)) return 0;
  let total = 0;
  for (const item of Object.values(loot.loot)) total += item.amount;
  return total;
}
