import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { BattleRules } from "./battle-rules.ts";
import { requireCombatLoadout } from "./combat-loadout.ts";
import { requireHuntBotSpellBook } from "./hunt-bot-spell-book.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";

export function requireHuntBattleInit(init: HuntBattleInit, rules: BattleRules): void {
  if (!init.areaId) throw new Error("Battle area is required");
  requireCombatLoadout(init.loadout);
  requireHuntBotSpellBook(init.botSpellBook);
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
  if (rules.strPerDamagePoint < 1) throw new Error("strPerDamagePoint must be positive");
  if (
    typeof rules.damageSpread !== "number" ||
    Number.isNaN(rules.damageSpread) ||
    rules.damageSpread <= 0 ||
    rules.damageSpread >= 1
  ) {
    throw new Error("damageSpread must be in (0, 1)");
  }
  if (!Number.isInteger(init.heroStrength) || init.heroStrength < 1) {
    throw new Error("Battle hero strength must be positive");
  }
  if (!Number.isInteger(init.botStrength) || init.botStrength < 1) {
    throw new Error("Battle bot strength must be positive");
  }
  if (rules.turnTimeoutSeconds < 1) throw new Error("Turn timeout must be positive");
  if (!Number.isInteger(rules.meleeBotCounterMs) || rules.meleeBotCounterMs < 1) {
    throw new Error("Melee bot-counter delay must be positive");
  }
  if (!Number.isInteger(rules.turnGrantDelayMs) || rules.turnGrantDelayMs < 1) {
    throw new Error("Turn grant delay must be positive");
  }
  if (rules.turnGrantDelayMs < rules.meleeBotCounterMs) {
    throw new Error("Turn grant delay must be at least the melee bot-counter delay");
  }
}
