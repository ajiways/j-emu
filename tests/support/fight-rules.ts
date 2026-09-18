import { Battle } from "../../src/modules/combat/domain/battle.ts";
import { isHumanDuelInit } from "../../src/modules/combat/domain/battle-fighters.ts";
import { FightRules } from "../../src/modules/combat/domain/fight-rules.ts";
import type { FriendlyDuelBattleInit } from "../../src/modules/combat/domain/friendly-duel-battle-init.ts";
import type { HuntBattleInit } from "../../src/modules/combat/domain/hunt-battle-init.ts";
import type { RandomSource } from "../../src/modules/combat/domain/random-source.ts";
import { UNIT_BATTLE_RULES } from "./battle-rules.ts";

function fightRulesForInit(init: HuntBattleInit | FriendlyDuelBattleInit): FightRules {
  if (isHumanDuelInit(init)) {
    return FightRules.for({ kind: init.kind });
  }
  if (init.purpose === "quest") {
    return FightRules.for({
      kind: "quest",
      botCount: 1 + init.extraEnemies.length + init.allies.length,
    });
  }
  if (init.purpose === "hunt") {
    return FightRules.for({ kind: "hunt", instanceCopyId: init.instanceCopyId });
  }
  throw new Error(`Unknown hunt purpose: ${String(init.purpose)}`);
}

export function createUnitBattle(
  init: HuntBattleInit | FriendlyDuelBattleInit,
  random: RandomSource,
): Battle {
  return new Battle(init, UNIT_BATTLE_RULES, fightRulesForInit(init), random);
}
