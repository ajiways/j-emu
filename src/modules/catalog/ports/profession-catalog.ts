import type { ProfessionDefinition } from "../domain/profession-definition.ts";

export interface ProfessionCatalog {
  profession(id: number): Promise<ProfessionDefinition | null>;
  professions(): Promise<readonly ProfessionDefinition[]>;
}
