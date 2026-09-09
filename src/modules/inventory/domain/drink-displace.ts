import { ARTIFACT_KIND_SET_BONUS } from "../../catalog/domain/artifact-kind.ts";
import { SLOT_TEMPEFFECT } from "./gear-sets.ts";

export const KIND_INJURY = 111;
const EFFECT_PERSIST_FOR_ONE_FIGHT = 256;
const ONE_FIGHT_EXPIRE = 1;
const TYPE_HIGHER_BUFF = "146";

export type DrinkDisplacePeer = Readonly<{
  id: number;
  artifactId: number;
  typeId: string;
  kindId: number;
}>;

export function drinkTypeStackCap(typeId: string): number {
  return typeId === TYPE_HIGHER_BUFF ? 2 : 1;
}

function isOneFightFlags(flagsExt: number): boolean {
  return (flagsExt & EFFECT_PERSIST_FOR_ONE_FIGHT) !== 0;
}

export function isTempEffectMask(slotMask: number): boolean {
  return (slotMask & SLOT_TEMPEFFECT) !== 0;
}

export function drinkExpireAt(flagsExt: number, durationSec: number, nowSec: number): number {
  if (!Number.isInteger(nowSec) || nowSec < 1) {
    throw new Error("DRINK nowSec must be a positive unix timestamp");
  }
  if (isOneFightFlags(flagsExt)) return ONE_FIGHT_EXPIRE;
  if (durationSec > 0) return nowSec + durationSec;
  return 0;
}

export function drinkDisplaceIds(
  equipped: readonly DrinkDisplacePeer[],
  incoming: Readonly<{ id: number; artifactId: number; typeId: string }>,
): readonly number[] {
  const cap = drinkTypeStackCap(incoming.typeId);
  const sameType = equipped.filter((row) => {
    if (row.id === incoming.id) return false;
    if (row.kindId === KIND_INJURY || row.kindId === ARTIFACT_KIND_SET_BONUS) return false;
    return row.typeId === incoming.typeId;
  });
  const sameArtikul = sameType.filter((row) => row.artifactId === incoming.artifactId);
  const others = sameType.filter((row) => row.artifactId !== incoming.artifactId);
  const roomForOthers = Math.max(0, cap - 1);
  const oldestFirst = [...others].sort((left, right) => left.id - right.id);
  const dropOldest =
    oldestFirst.length > roomForOthers
      ? oldestFirst.slice(0, oldestFirst.length - roomForOthers)
      : [];
  return [...sameArtikul, ...dropOldest].map((row) => row.id);
}
