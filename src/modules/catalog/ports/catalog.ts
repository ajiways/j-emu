import type { CommonConfBlock } from "../../content/domain/bootstrap-content.ts";
import type { AppearancePreset } from "../domain/appearance-preset.ts";
import type { ArtifactDefinition } from "../domain/artifact-definition.ts";
import type { BootstrapChrome } from "../domain/bootstrap-chrome.ts";
import type { BotDefinition } from "../domain/bot-definition.ts";
import type { HudDefaults } from "../domain/hud-defaults.ts";
import type { LevelBoundary } from "../domain/level-boundary.ts";
import type { SkillDefinition } from "../domain/skill-definition.ts";

export interface Catalog {
  artifact(id: number): Promise<ArtifactDefinition | null>;
  bot(id: number): Promise<BotDefinition | null>;
  skill(id: string): Promise<SkillDefinition>;
  level(level: number): Promise<LevelBoundary>;
  appearance(kind: number, gender: number): Promise<AppearancePreset>;
  hudDefaults(): Promise<HudDefaults>;
  chrome(): Promise<BootstrapChrome>;
  commonConf(): Promise<CommonConfBlock>;
}
