import type { ArtifactDefinition } from "../domain/artifact-definition.ts";
import type { BotDefinition } from "../domain/bot-definition.ts";

export interface Catalog {
  artifact(id: number): Promise<ArtifactDefinition | null>;
  bot(id: number): Promise<BotDefinition | null>;
}
