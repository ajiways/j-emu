/** Copy of Pub1 `common.amf` `artifact_upgrades` types 1–3. Type 4 is not served. */

export const UPGRADE_TYPE_LEGACY = 1;
export const UPGRADE_TYPE_ACTUAL = 2;
export const UPGRADE_TYPE_ACTUAL_100 = 3;
export const UPGRADE_TYPE_UNLIMITED = 4;
export const UPGRADE_MAX_LEVEL = 6;
export const UPGRADE_PARAM_CHANGE_SKILL = 2;
export const CAN_BE_UPGRADED = 512;
export const ARTIFACT_FLAG_NOGIVE = 32;

export const UPGRADE_FAIL_ERROR = "Заточка не удалась.";
export const UPGRADE_UNSUPPORTED = "Это действие предмета пока не поддержано.";
export const UPGRADE_RESONATOR_ERROR = "Нельзя сменить заточку.";

export const COMBAT_UPGRADE_SKILL_IDS = ["STR", "RAG", "DEX", "DEF", "VIT", "MPMAX"] as const;

const BIND_ON_FIRST_SUCCESS = new Set([553, 605, 13779]);

export type UpgradeSkillAdd = Readonly<{
  skillId: string;
  title: string;
  value: number;
}>;

export type UpgradeTable = Readonly<{
  id: number;
  maxLevel: number;
  chance: Readonly<Record<number, number>>;
  mult: Readonly<Record<number, number>>;
  skillAdd: readonly UpgradeSkillAdd[];
}>;

const ARTIFACT_UPGRADES: Readonly<Record<number, UpgradeTable>> = {
  [UPGRADE_TYPE_LEGACY]: {
    id: 1,
    maxLevel: 6,
    chance: { 1: 90, 2: 55, 3: 10, 4: 5, 5: 2.5, 6: 1 },
    mult: { 1: 0.2, 2: 0.4, 3: 0.6, 4: 0.8, 5: 1, 6: 1.2 },
    skillAdd: [],
  },
  [UPGRADE_TYPE_ACTUAL]: {
    id: 2,
    maxLevel: 6,
    chance: { 1: 90, 2: 55, 3: 10, 4: 5, 5: 2.5, 6: 1 },
    mult: { 1: 0.15, 2: 0.28, 3: 0.38, 4: 0.45, 5: 0.5, 6: 0.55 },
    skillAdd: [
      { title: "Травматизм", skillId: "INJ_PROB", value: 1 },
      { title: "Блокирование", skillId: "BLOK", value: 1 },
      { title: "Стойкость", skillId: "BLOK_VISUAL", value: 1 },
    ],
  },
  [UPGRADE_TYPE_ACTUAL_100]: {
    id: 3,
    maxLevel: 6,
    chance: { 1: 100, 2: 100, 3: 100, 4: 100, 5: 100, 6: 100 },
    mult: { 1: 0.15, 2: 0.28, 3: 0.38, 4: 0.45, 5: 0.5, 6: 0.55 },
    skillAdd: [
      { title: "Травматизм", skillId: "INJ_PROB", value: 1 },
      { title: "Блокирование", skillId: "BLOK", value: 1 },
      { title: "Стойкость", skillId: "BLOK_VISUAL", value: 1 },
    ],
  },
};

export function upgradeTable(type: number): UpgradeTable | null {
  return ARTIFACT_UPGRADES[type] ?? null;
}

export function isSupportedUpgradeType(type: number): boolean {
  return (
    type === UPGRADE_TYPE_LEGACY || type === UPGRADE_TYPE_ACTUAL || type === UPGRADE_TYPE_ACTUAL_100
  );
}

export function upgradeTypesCompatible(itemType: number, crystalType: number): boolean {
  if (!itemType) return true;
  if (itemType === crystalType) return true;
  const actual = (type: number) => type === UPGRADE_TYPE_ACTUAL || type === UPGRADE_TYPE_ACTUAL_100;
  return actual(itemType) && actual(crystalType);
}

export function namedAdds(type: number, level: number): readonly UpgradeSkillAdd[] {
  if (level < UPGRADE_MAX_LEVEL) return [];
  const table = upgradeTable(type);
  if (!table) throw new Error(`Upgrade table for type ${type} is missing`);
  return table.skillAdd;
}

export function shouldBindOnSuccess(artikulId: number, newLevel: number): boolean {
  return newLevel >= UPGRADE_MAX_LEVEL || BIND_ON_FIRST_SUCCESS.has(artikulId);
}
