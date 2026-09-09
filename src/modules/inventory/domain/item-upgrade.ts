export type ItemUpgrade = Readonly<{
  id: number;
  level: number;
  skillId: string;
  bound: boolean;
}>;

export const UNUPGRADED: ItemUpgrade = {
  id: 0,
  level: 0,
  skillId: "",
  bound: false,
};

export function requireItemUpgrade(upgrade: ItemUpgrade): ItemUpgrade {
  if (!Number.isInteger(upgrade.id) || upgrade.id < 0) {
    throw new Error("Upgrade id is invalid");
  }
  if (!Number.isInteger(upgrade.level) || upgrade.level < 0 || upgrade.level > 6) {
    throw new Error("Upgrade level is invalid");
  }
  if (upgrade.level === 0) {
    if (upgrade.id !== 0 || upgrade.skillId !== "" || upgrade.bound) {
      throw new Error("Unupgraded item cannot carry upgrade overlay fields");
    }
    return upgrade;
  }
  if (upgrade.id < 1 || upgrade.skillId === "") {
    throw new Error("Upgraded item requires upgrade id and skill");
  }
  return upgrade;
}
