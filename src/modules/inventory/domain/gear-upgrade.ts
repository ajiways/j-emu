import { ArtifactSkillBonus } from "../../catalog/domain/artifact-skill-bonus.ts";
import type { ArtifactUseAction } from "../../catalog/domain/artifact-use-action.ts";
import { isPaperdollSlotMask } from "./paperdoll-slot.ts";
import type { ItemUpgrade } from "./item-upgrade.ts";
import {
  COMBAT_UPGRADE_SKILL_IDS,
  isSupportedUpgradeType,
  namedAdds,
  UPGRADE_MAX_LEVEL,
  UPGRADE_PARAM_CHANGE_SKILL,
  UPGRADE_TYPE_UNLIMITED,
  upgradeTable,
  type UpgradeSkillAdd,
} from "./upgrade-tables.ts";

const COMBAT_SET = new Set<string>(COMBAT_UPGRADE_SKILL_IDS);
const TYPE_ARTIFACT = "67";
const TYPE_BANDOLIER = "70";
const KIND_BANDOLIER = 95;

export type UpgradeAction = Readonly<{
  code: "ARTIFACT_UPGRADE";
  param1: number;
  param2: number;
}>;

export type UpgradeSkillPick = Readonly<{ skillId: string; base: number }>;

export function parseUpgradeAction(
  useActions: Readonly<Record<string, ArtifactUseAction>>,
): UpgradeAction | null {
  for (const action of Object.values(useActions)) {
    if (action.code !== "ARTIFACT_UPGRADE") continue;
    if (typeof action.param1 !== "number" || typeof action.param2 !== "number") {
      throw new Error("ARTIFACT_UPGRADE params must be integers");
    }
    return { code: "ARTIFACT_UPGRADE", param1: action.param1, param2: action.param2 };
  }
  return null;
}

export function upgradeChance(type: number, nextLevel: number): number {
  const table = upgradeTable(type);
  if (!table) return 0;
  const chance = table.chance[nextLevel];
  if (chance === undefined)
    throw new Error(`Upgrade chance for type ${type} level ${nextLevel} is missing`);
  return chance;
}

export function upgradeBonusTotal(type: number, level: number, base: number): number {
  const table = upgradeTable(type);
  if (!table || level <= 0) return 0;
  const m = table.mult[Math.min(level, table.maxLevel)];
  if (m === undefined) throw new Error(`Upgrade mult for type ${type} level ${level} is missing`);
  return Math.ceil(base * m);
}

function isUpgradeBlockedKind(typeId: string, kindId: number): boolean {
  if (typeId === TYPE_ARTIFACT || typeId === TYPE_BANDOLIER) return true;
  return kindId === KIND_BANDOLIER;
}

export function upgradeSkillPool(skills: readonly ArtifactSkillBonus[]): UpgradeSkillPick[] {
  const out: UpgradeSkillPick[] = [];
  const seen = new Set<string>();
  for (const skill of skills) {
    if (!COMBAT_SET.has(skill.id) || seen.has(skill.id) || skill.value <= 0) continue;
    seen.add(skill.id);
    out.push({ skillId: skill.id, base: skill.value });
  }
  return out;
}

export function canItemBeUpgraded(opts: {
  typeId: string;
  kindId: number;
  skills: readonly ArtifactSkillBonus[];
  upgradeId: number;
  upgradeLevel: number;
  slotMask: number;
}): boolean {
  if (!isPaperdollSlotMask(opts.slotMask)) return false;
  if (isUpgradeBlockedKind(opts.typeId, opts.kindId)) return false;
  if (opts.upgradeId === UPGRADE_TYPE_UNLIMITED) return false;
  if (opts.upgradeId !== 0 && !isSupportedUpgradeType(opts.upgradeId)) return false;
  if (opts.upgradeLevel >= UPGRADE_MAX_LEVEL) return false;
  return upgradeSkillPool(opts.skills).length > 0;
}

export function canResonateItem(opts: {
  typeId: string;
  kindId: number;
  skills: readonly ArtifactSkillBonus[];
  upgradeId: number;
  upgradeLevel: number;
  slotMask: number;
}): boolean {
  if (!isPaperdollSlotMask(opts.slotMask)) return false;
  if (isUpgradeBlockedKind(opts.typeId, opts.kindId)) return false;
  if (opts.upgradeLevel < 1) return false;
  if (!isSupportedUpgradeType(opts.upgradeId)) return false;
  return upgradeSkillPool(opts.skills).length > 1;
}

export function pickUpgradeSkill(
  pool: readonly UpgradeSkillPick[],
  rng: () => number,
  exceptSkillId?: string,
): string | null {
  const candidates = exceptSkillId
    ? pool.filter((pick) => pick.skillId !== exceptSkillId)
    : [...pool];
  if (candidates.length === 0) return null;
  const i = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length));
  return candidates[i]!.skillId;
}

export function rollUpgradeSuccess(chancePercent: number, rng: () => number): boolean {
  if (chancePercent >= 100) return true;
  if (chancePercent <= 0) return false;
  return rng() * 100 < chancePercent;
}

export function isResonatorAction(action: UpgradeAction): boolean {
  return (action.param1 & UPGRADE_PARAM_CHANGE_SKILL) !== 0;
}

export function overlaySkillBonuses(
  catalogSkills: readonly ArtifactSkillBonus[],
  upgrade: ItemUpgrade,
): readonly ArtifactSkillBonus[] {
  if (upgrade.level < 1) return catalogSkills;
  const pool = upgradeSkillPool(catalogSkills);
  const picked = pool.find((row) => row.skillId === upgrade.skillId);
  if (!picked) throw new Error(`Upgrade skill ${upgrade.skillId} is not in the catalog pool`);
  const bonus = upgradeBonusTotal(upgrade.id, upgrade.level, picked.base);
  const extras = namedAdds(upgrade.id, upgrade.level);
  const extraIds = new Set(extras.map((row) => row.skillId));
  const out: ArtifactSkillBonus[] = [];
  for (const skill of catalogSkills) {
    if (extraIds.has(skill.id)) continue;
    const value = skill.id === upgrade.skillId ? skill.value + bonus : skill.value;
    out.push(new ArtifactSkillBonus(skill.id, value, skill.flags));
  }
  for (const extra of extras) {
    out.push(new ArtifactSkillBonus(extra.skillId, extra.value, 0));
  }
  return out;
}

export function overlayNamedAdds(upgrade: ItemUpgrade): readonly UpgradeSkillAdd[] {
  return namedAdds(upgrade.id, upgrade.level);
}

export function overlayPrimaryBonus(
  catalogSkills: readonly ArtifactSkillBonus[],
  upgrade: ItemUpgrade,
): number {
  if (upgrade.level < 1) return 0;
  const picked = upgradeSkillPool(catalogSkills).find((row) => row.skillId === upgrade.skillId);
  if (!picked) throw new Error(`Upgrade skill ${upgrade.skillId} is not in the catalog pool`);
  return upgradeBonusTotal(upgrade.id, upgrade.level, picked.base);
}
