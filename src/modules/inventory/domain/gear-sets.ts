/** Copy of jgr-emu `gearSets.ts`: set_id bonuses, trend mix, portrait at 4. */

export const SET_MIX_ERROR = "Эту вещь нельзя надеть!";
export const SET_AVATAR_MIN = 4;
export const KIND_SET = 139;
export const SLOT_TEMPEFFECT = 134_217_728;
export const SET_BONUS_EXPIRE = 0;

export type SetBonusThreshold = Readonly<{ count: number; artikulId: number }>;

export type ArtifactSetInfo = Readonly<{
  setId: number;
  trend: number;
  thresholds: readonly SetBonusThreshold[];
  avatarMan: string;
  avatarWoman: string;
}>;

export type WornSetCount = Readonly<{
  setId: number;
  count: number;
  info: ArtifactSetInfo;
}>;

export type SetPortrait = Readonly<{ big: string; small: string }>;

const PAPERDOLL_BITS = 0x000f_ffff;

export function parseTrend(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function parseSetId(info: ArtifactSetInfo | null | undefined): number {
  if (!info) return 0;
  return info.setId > 0 ? info.setId : 0;
}

export function pickSetBonusArtikul(
  thresholds: readonly SetBonusThreshold[],
  wornCount: number,
): number {
  let bestN = 0;
  let bestId = 0;
  for (const row of thresholds) {
    if (row.count <= wornCount && row.count >= bestN) {
      bestN = row.count;
      bestId = row.artikulId;
    }
  }
  return bestId;
}

export function setAvatarSmallName(big: string): string {
  const trimmed = big.trim();
  if (!trimmed) return "";
  return trimmed.replace(/(\.[^.]+)$/i, "_sm$1");
}

function parseSetAvatarBig(info: ArtifactSetInfo, male: boolean): string {
  const primary = (male ? info.avatarMan : info.avatarWoman).trim();
  if (primary) return primary;
  return info.avatarMan.trim();
}

export function pickSetPortrait(worn: readonly WornSetCount[], male: boolean): SetPortrait | null {
  let bestCount = 0;
  let bestBig = "";
  for (const row of worn) {
    if (row.count < SET_AVATAR_MIN) continue;
    const big = parseSetAvatarBig(row.info, male);
    if (!big) continue;
    if (row.count > bestCount) {
      bestCount = row.count;
      bestBig = big;
    }
  }
  if (!bestBig) return null;
  return { big: bestBig, small: setAvatarSmallName(bestBig) };
}

export function isMaleHeroGender(gender: number): boolean {
  return gender !== 2;
}

export function setMixBlocked(trends: readonly number[]): boolean {
  const classes = [...new Set(trends.filter((trend) => trend > 0))];
  return classes.length > 1;
}

export function isSetPieceSlot(slot: number, slotMask: number): boolean {
  if (slot <= 0) return false;
  if (slot === SLOT_TEMPEFFECT) return false;
  if ((slotMask & SLOT_TEMPEFFECT) !== 0) return false;
  return (slot & PAPERDOLL_BITS) !== 0;
}

export function skipSetCountKind(kindId: number): boolean {
  return kindId === KIND_SET;
}

export function wantedSetBonusArtikuls(worn: readonly WornSetCount[]): readonly number[] {
  const wanted = new Set<number>();
  for (const row of worn) {
    const bonusId = pickSetBonusArtikul(row.info.thresholds, row.count);
    if (bonusId) wanted.add(bonusId);
  }
  return [...wanted];
}
