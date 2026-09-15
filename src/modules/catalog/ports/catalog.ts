import type { CommonConfBlock } from "../../content/domain/bootstrap-content.ts";
import type { AppearancePreset } from "../domain/appearance-preset.ts";
import type { ArtifactBonus } from "../domain/artifact-bonus.ts";
import type { ArtifactBrief, ArtifactSearchQuery } from "../domain/artifact-brief.ts";
import type { ArtifactDefinition } from "../domain/artifact-definition.ts";
import type { UseScript } from "../domain/use-script.ts";
import type { BootstrapChrome } from "../domain/bootstrap-chrome.ts";
import type { BotDefinition } from "../domain/bot-definition.ts";
import type { HudDefaults } from "../domain/hud-defaults.ts";
import type { LevelBoundary } from "../domain/level-boundary.ts";
import type { SkillDefinition } from "../domain/skill-definition.ts";
import type { StoreLot, StoreType } from "../domain/store-lot.ts";
import type { ReputationCatalog } from "./reputation-catalog.ts";
import type { ProfessionCatalog } from "./profession-catalog.ts";
import type { FarmCatalog } from "./farm-catalog.ts";
import type { CraftCatalog } from "./craft-catalog.ts";

export interface Catalog extends ReputationCatalog, ProfessionCatalog, FarmCatalog, CraftCatalog {
  artifact(id: number): Promise<ArtifactDefinition | null>;
  searchArtifacts(query: ArtifactSearchQuery): Promise<readonly ArtifactBrief[]>;
  bonus(id: number): Promise<ArtifactBonus | null>;
  useScript(bonusId: number): Promise<UseScript | null>;
  bot(id: number): Promise<BotDefinition | null>;
  skill(id: string): Promise<SkillDefinition>;
  level(level: number): Promise<LevelBoundary>;
  appearance(kind: number, gender: number): Promise<AppearancePreset>;
  hudDefaults(): Promise<HudDefaults>;
  chrome(): Promise<BootstrapChrome>;
  commonConf(): Promise<CommonConfBlock>;
  storeTypes(areaId: string): Promise<readonly StoreType[]>;
  storeLots(areaId: string): Promise<readonly StoreLot[]>;
}
