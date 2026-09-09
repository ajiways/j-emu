import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { BattleRules } from "./battle.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";

export function requireHuntBattleInit(init: HuntBattleInit, rules: BattleRules): void {
  if (!init.areaId) throw new Error("Battle area is required");
  requireWireIdentity(init.accountId, "account id");
  requireWireIdentity(init.heroId, "hero id");
  requireWireIdentity(init.botArtikulId, "bot artikul id");
  requireWireIdentity(init.botFightId, "bot fight id");
  if (init.botFightId === init.heroId) {
    throw new Error("Fight bot id collides with the human participant id");
  }
  if (init.botFightId < 1_000_000) {
    throw new Error("Fight bot id is below the ephemeral floor");
  }
  if (!Number.isInteger(init.heroLevel) || init.heroLevel < 1) {
    throw new Error("Battle hero level must be positive");
  }
  if (!Number.isInteger(init.heroKind) || init.heroKind < 1) {
    throw new Error("Battle hero kind must be positive");
  }
  if (!Number.isInteger(init.playerHp) || init.playerHp < 1) {
    throw new Error("Battle hero hp must be positive");
  }
  if (!Number.isInteger(init.playerMaxHp) || init.playerMaxHp < init.playerHp) {
    throw new Error("Battle hero maxHp is invalid");
  }
  if (!Number.isInteger(init.heroMp) || init.heroMp < 0) {
    throw new Error("Battle hero mp is invalid");
  }
  if (!Number.isInteger(init.heroMaxMp) || init.heroMaxMp < 1 || init.heroMp > init.heroMaxMp) {
    throw new Error("Battle hero maxMp is invalid");
  }
  if (!init.botAvatar) throw new Error("Battle bot avatar is required");
  if (!init.botSk) throw new Error("Battle bot sk is required");
  if (typeof init.botBody !== "string") throw new Error("Battle bot body is required");
  if (rules.playerDamageMin < 0 || rules.playerDamageMax < rules.playerDamageMin) {
    throw new Error("Player damage rules are invalid");
  }
  if (rules.botDamageMin < 0 || rules.botDamageMax < rules.botDamageMin) {
    throw new Error("Bot damage rules are invalid");
  }
  if (rules.turnTimeoutSeconds < 1) throw new Error("Turn timeout must be positive");
}
