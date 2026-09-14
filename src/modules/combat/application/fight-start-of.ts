import type { Battle } from "../domain/battle.ts";
import type { FightStart } from "../ports/combat-port.ts";

export function fightStartOf(battle: Battle, participantId: number): FightStart {
  return {
    fightId: battle.id,
    accessKey: battle.accessKey,
    participantId,
    arena: battle.arena,
    purpose: battle.purpose,
    instanceCopyId: battle.instanceCopyId,
    fightFlags: battle.fightFlags,
  };
}
