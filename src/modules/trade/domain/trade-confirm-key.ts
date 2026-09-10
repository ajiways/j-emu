import { createHash, randomBytes } from "node:crypto";

export function newConfirmKey(): string {
  return createHash("md5").update(randomBytes(16)).digest("hex");
}

export function tradeBanKey(trayId: number, targetHeroId: number): string {
  if (!Number.isInteger(trayId) || trayId < 1) throw new Error("Trade tray id is invalid");
  if (!Number.isInteger(targetHeroId) || targetHeroId < 1) {
    throw new Error("Trade target hero id is invalid");
  }
  return createHash("md5").update(`trade:${trayId}:${targetHeroId}`).digest("hex");
}
