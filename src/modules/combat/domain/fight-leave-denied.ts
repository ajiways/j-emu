export const FIGHT_LEAVE_DENIED = "нельзя выйти из боя";

export function fightLeaveDenied(
  purpose: "hunt" | "quest" | "friendly-duel" | "pvp",
  instanceCopyId: number | null,
): boolean {
  return purpose === "quest" || instanceCopyId !== null;
}
