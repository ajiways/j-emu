import type {
  BattlegroundLeaderGroup,
  BattlegroundRoomPos,
} from "../../battleground/domain/battleground-definition.ts";

export type BattlegroundDocument = Readonly<{
  id: number;
  type: string;
  title: string;
  flags: number;
  available: 0 | 1;
  queueLevel: string;
  error: string;
  playable: 0 | 1;
  instArtikulId: number;
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
