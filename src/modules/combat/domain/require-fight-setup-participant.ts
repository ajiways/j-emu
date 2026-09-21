import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import { requireCombatLoadout } from "./combat-loadout.ts";
import { isFightSetupAi, isFightSetupHuman, type FightSetupParticipant } from "./fight-setup.ts";
import { requireHuntBotSpellBook } from "./hunt-bot-spell-book.ts";

export function requireFightSetupParticipant(participant: FightSetupParticipant): void {
  if (isFightSetupHuman(participant)) {
    requireHuman(participant);
    return;
  }
  if (isFightSetupAi(participant)) {
    requireAi(participant);
    return;
  }
  const unknown = participant as { controller?: unknown };
  throw new Error(`Unknown fight participant controller: ${String(unknown.controller)}`);
}

function requireHuman(human: Extract<FightSetupParticipant, { controller: "human" }>): void {
  requireWireIdentity(human.accountId, "account id");
  requireWireIdentity(human.heroId, "hero id");
  if (!human.nick) throw new Error("Battle hero nick is required");
  if (!Number.isInteger(human.level) || human.level < 1) {
    throw new Error("Battle hero level must be positive");
  }
  if (!Number.isInteger(human.kind) || human.kind < 1) {
    throw new Error("Battle hero kind must be positive");
  }
  if (!Number.isInteger(human.hp) || human.hp < 1) {
    throw new Error("Battle hero hp must be positive");
  }
  if (!Number.isInteger(human.maxHp) || human.maxHp < human.hp) {
    throw new Error("Battle hero maxHp is invalid");
  }
  if (!Number.isInteger(human.mp) || human.mp < 0) {
    throw new Error("Battle hero mp is invalid");
  }
  if (!Number.isInteger(human.maxMp) || human.maxMp < 1 || human.mp > human.maxMp) {
    throw new Error("Battle hero maxMp is invalid");
  }
  if (!Number.isInteger(human.strength) || human.strength < 1) {
    throw new Error("Battle hero strength must be positive");
  }
  if (!Number.isInteger(human.magPower) || human.magPower < 0) {
    throw new Error("Battle hero mag power must be a non-negative integer");
  }
  if (!Number.isInteger(human.magResist) || human.magResist < 0) {
    throw new Error("Battle hero mag resist must be a non-negative integer");
  }
  if (!human.appearance.avatar) throw new Error("Battle hero avatar is required");
  if (typeof human.appearance.body !== "string") throw new Error("Battle hero body is required");
  if (!human.appearance.sk) throw new Error("Battle hero sk is required");
  requireCombatLoadout(human.loadout);
}

function requireAi(ai: Extract<FightSetupParticipant, { controller: "ai" }>): void {
  requireWireIdentity(ai.fightId, "bot fight id");
  requireWireIdentity(ai.artikulId, "bot artikul id");
  if (ai.fightId < 1_000_000) {
    throw new Error("Fight bot id is below the ephemeral floor");
  }
  if (!ai.nick) throw new Error("Battle bot nick is required");
  if (!Number.isInteger(ai.level) || ai.level < 1) {
    throw new Error("Battle bot level must be positive");
  }
  if (!Number.isInteger(ai.hp) || ai.hp < 1) {
    throw new Error("Battle bot hp must be positive");
  }
  if (!Number.isInteger(ai.strength) || ai.strength < 1) {
    throw new Error("Battle bot strength must be positive");
  }
  if (!Number.isInteger(ai.initiative) || ai.initiative < 0) {
    throw new Error("Battle bot initiative must be a non-negative integer");
  }
  if (!Number.isInteger(ai.magPower) || ai.magPower < 0) {
    throw new Error("Battle bot mag power must be a non-negative integer");
  }
  if (!Number.isInteger(ai.magResist) || ai.magResist < 0) {
    throw new Error("Battle bot mag resist must be a non-negative integer");
  }
  if (!ai.avatar) throw new Error("Battle bot avatar is required");
  if (!ai.sk) throw new Error("Battle bot sk is required");
  if (typeof ai.body !== "string") throw new Error("Battle bot body is required");
  requireHuntBotSpellBook(ai.spellBook);
}
