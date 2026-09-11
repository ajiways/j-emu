import type { AssistantTypeDefinition } from "../domain/assistant-type-definition.ts";
import type { AreaFarmDefinition } from "../domain/area-farm-definition.ts";
import type { FarmResourceDefinition } from "../domain/farm-resource-definition.ts";

export interface FarmCatalog {
  assistantType(id: number): Promise<AssistantTypeDefinition | null>;
  assistantTypes(): Promise<readonly AssistantTypeDefinition[]>;
  farmResource(id: number): Promise<FarmResourceDefinition | null>;
  areaFarms(areaId: string): Promise<readonly AreaFarmDefinition[]>;
}
