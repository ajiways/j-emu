export type BattlegroundRoomPos = Readonly<{
  areaId: string;
  x: number;
  y: number;
  title: string;
}>;

export type BattlegroundLeaderGroup = Readonly<{
  id: string;
  minLevel: string;
  maxLevel: string;
}>;

export type BattlegroundDefinition = Readonly<{
  id: number;
  type: string;
  title: string;
  flags: number;
  available: 0 | 1;
  queueLevel: string;
  error: string;
  playable: boolean;
  instArtikulId: string;
  levelMin: number;
  levelMax: number;
  returnAreaId: string;
  westAreaId: string;
  arenaAreaId: string;
  eastAreaId: string;
  inviteTtlSec: number;
  banSec: number;
  matchDurationSec: number;
  maxScore: number;
  pointsPerKill: number;
  fightBg: string;
  fightFlags: string;
  mapPicture: string;
  statsPicture: string;
  description: string;
  rules: string;
  roomPos: readonly BattlegroundRoomPos[];
  leaderGroups: readonly BattlegroundLeaderGroup[];
}>;

export const KIND_NEUTRAL = 1;
export const KIND_LEAGUE = 2;
export const KIND_COHORT = 3;
export const HISTORY_PAGE_SIZE = 10;
export const FINISH_AFTER_FIGHT_MS = 2_000;

export function spawnAreaForKind(definition: BattlegroundDefinition, kind: number): string {
  if (kind === KIND_COHORT) return definition.westAreaId;
  if (kind === KIND_LEAGUE) return definition.eastAreaId;
  throw new Error(`Battleground spawn kind ${kind} is not a faction`);
}

export function isBattlegroundRoom(definition: BattlegroundDefinition, areaId: string): boolean {
  return (
    areaId === definition.westAreaId ||
    areaId === definition.arenaAreaId ||
    areaId === definition.eastAreaId
  );
}

export function formatBanError(remainSec: number): string {
  if (!Number.isInteger(remainSec) || remainSec < 0) {
    throw new Error("Ban remaining seconds must be a non-negative integer");
  }
  const min = Math.floor(remainSec / 60);
  const sec = remainSec % 60;
  return `Вы не сможете подать заявку еще ${min} мин. ${sec} сек.`;
}
