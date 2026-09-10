import type { BattlegroundDefinition } from "../domain/battleground-definition.ts";

export interface BattlegroundCatalog {
  list(): Promise<readonly BattlegroundDefinition[]>;
  byKey(type: string, id: number): Promise<BattlegroundDefinition | null>;
  playable(): Promise<BattlegroundDefinition>;
}
