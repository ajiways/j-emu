import { Battle } from "../../src/modules/combat/domain/battle.ts";
import { FightRules } from "../../src/modules/combat/domain/fight-rules.ts";
import { fightSetupAis, type FightSetup } from "../../src/modules/combat/domain/fight-setup.ts";
import type { RandomSource } from "../../src/modules/combat/domain/random-source.ts";
import { UNIT_BATTLE_RULES } from "./battle-rules.ts";

function fightRulesForSetup(setup: FightSetup): FightRules {
  const { kind, instanceCopyId } = setup.meta;
  if (kind === "quest") {
    return FightRules.for({ kind: "quest", botCount: fightSetupAis(setup).length });
  }
  if (kind === "hunt") {
    return FightRules.for({ kind: "hunt", instanceCopyId });
  }
  if (kind === "friendly-duel" || kind === "pvp") {
    return FightRules.for({ kind });
  }
  throw new Error(`Unknown fight kind: ${String(kind)}`);
}

export function createUnitBattle(setup: FightSetup, random: RandomSource): Battle {
  return new Battle(setup, UNIT_BATTLE_RULES, fightRulesForSetup(setup), random);
}
