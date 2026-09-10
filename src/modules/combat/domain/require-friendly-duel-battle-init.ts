import { parseDecimalId, requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { BattleRules } from "./battle-rules.ts";
import { requireCombatLoadout } from "./combat-loadout.ts";
import type {
  FriendlyDuelBattleInit,
  FriendlyDuelFighterInit,
} from "./friendly-duel-battle-init.ts";

export function requireFriendlyDuelBattleInit(
  init: FriendlyDuelBattleInit,
  rules: BattleRules,
): void {
  if (init.kind !== "friendly-duel") throw new Error("Friendly duel init kind is required");
  requireWireIdentity(
    Number(parseDecimalId(init.fightId, "friendly duel fight id")),
    "friendly duel fight id",
  );
  if (!init.areaId) throw new Error("Friendly duel area is required");
  if (!init.arena) throw new Error("Friendly duel arena is required");
  if (!init.accessKey) throw new Error("Friendly duel access key is required");
  requireFighter(init.challenger, "challenger");
  requireFighter(init.acceptor, "acceptor");
  if (init.challenger.accountId === init.acceptor.accountId) {
    throw new Error("Friendly duel accounts must be distinct");
  }
  if (init.challenger.heroId === init.acceptor.heroId) {
    throw new Error("Friendly duel heroes must be distinct");
  }
  if (rules.strPerDamagePoint < 1) throw new Error("strPerDamagePoint must be positive");
  if (
    typeof rules.damageSpread !== "number" ||
    Number.isNaN(rules.damageSpread) ||
    rules.damageSpread <= 0 ||
    rules.damageSpread >= 1
  ) {
    throw new Error("damageSpread must be in (0, 1)");
  }
  if (rules.turnTimeoutSeconds < 1) throw new Error("Turn timeout must be positive");
  if (!Number.isInteger(rules.turnGrantDelayMs) || rules.turnGrantDelayMs < 1) {
    throw new Error("Turn grant delay must be positive");
  }
}

function requireFighter(fighter: FriendlyDuelFighterInit, label: string): void {
  requireWireIdentity(fighter.accountId, `${label} account id`);
  requireWireIdentity(fighter.heroId, `${label} hero id`);
  if (!fighter.nick) throw new Error(`${label} nick is required`);
  if (!Number.isInteger(fighter.level) || fighter.level < 1) {
    throw new Error(`${label} level must be positive`);
  }
  if (!Number.isInteger(fighter.kind) || fighter.kind < 1) {
    throw new Error(`${label} kind must be positive`);
  }
  if (!Number.isInteger(fighter.hp) || fighter.hp < 1) {
    throw new Error(`${label} hp must be positive`);
  }
  if (!Number.isInteger(fighter.maxHp) || fighter.maxHp < fighter.hp) {
    throw new Error(`${label} maxHp is invalid`);
  }
  if (!Number.isInteger(fighter.mp) || fighter.mp < 0) {
    throw new Error(`${label} mp is invalid`);
  }
  if (!Number.isInteger(fighter.maxMp) || fighter.maxMp < 1 || fighter.mp > fighter.maxMp) {
    throw new Error(`${label} maxMp is invalid`);
  }
  if (!Number.isInteger(fighter.strength) || fighter.strength < 1) {
    throw new Error(`${label} strength must be positive`);
  }
  if (!fighter.avatar) throw new Error(`${label} avatar is required`);
  if (typeof fighter.body !== "string") throw new Error(`${label} body is required`);
  if (!fighter.sk) throw new Error(`${label} sk is required`);
  requireCombatLoadout(fighter.loadout);
}
