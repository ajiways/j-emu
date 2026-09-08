import { and, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { CommonConfBlock } from "../../content/domain/bootstrap-content.ts";
import type { ActiveContentRevision } from "../../content/ports/active-content-revision.ts";
import { AppearancePreset } from "../domain/appearance-preset.ts";
import { ArtifactDefinition } from "../domain/artifact-definition.ts";
import { artifactSkillsFromJson } from "./artifact-skills-from-json.ts";
import { BootstrapChrome } from "../domain/bootstrap-chrome.ts";
import { BotDefinition } from "../domain/bot-definition.ts";
import { HudDefaults } from "../domain/hud-defaults.ts";
import { HuntLook } from "../domain/hunt-look.ts";
import { LevelBoundary } from "../domain/level-boundary.ts";
import { SkillDefinition } from "../domain/skill-definition.ts";
import type { Catalog } from "../ports/catalog.ts";
import {
  appearancePresets,
  artifacts,
  bots,
  gameWideDocuments,
  levelBoundaries,
  skillDefinitions,
} from "./schema.ts";

export class PostgresCatalog implements Catalog {
  constructor(
    private readonly database: PostgresDatabase,
    private readonly revision: ActiveContentRevision,
  ) {}

  async artifact(id: number): Promise<ArtifactDefinition | null> {
    const releaseId = await this.revision.requireId();
    const rows = await this.database
      .session()
      .select()
      .from(artifacts)
      .where(and(eq(artifacts.releaseId, releaseId), eq(artifacts.id, id)));
    if (rows.length > 1) throw new Error(`Multiple artifact definitions found for ${id}`);
    const row = rows[0];
    return row
      ? new ArtifactDefinition(
          row.id,
          row.title,
          row.picture,
          row.typeId,
          row.kindId,
          row.slotMask,
          row.weight,
          row.levelMin,
          row.levelMax,
          row.gender,
          artifactSkillsFromJson(row.id, row.skills),
        )
      : null;
  }

  async bot(id: number): Promise<BotDefinition | null> {
    const releaseId = await this.revision.requireId();
    const rows = await this.database
      .session()
      .select()
      .from(bots)
      .where(and(eq(bots.releaseId, releaseId), eq(bots.id, id)));
    if (rows.length > 1) throw new Error(`Multiple bot definitions found for ${id}`);
    const row = rows[0];
    return row
      ? new BotDefinition(
          row.id,
          row.title,
          row.level,
          row.maxHp,
          row.strength,
          new HuntLook(
            row.huntNick,
            row.huntSwf,
            row.huntScale,
            row.huntFps,
            row.huntSpeed,
            row.huntAvatar,
            row.huntKind,
            row.huntHideOnMap,
          ),
        )
      : null;
  }

  async skill(id: string): Promise<SkillDefinition> {
    if (!id) throw new Error("Skill id is required");
    const releaseId = await this.revision.requireId();
    const rows = await this.database
      .session()
      .select()
      .from(skillDefinitions)
      .where(and(eq(skillDefinitions.releaseId, releaseId), eq(skillDefinitions.id, id)));
    if (rows.length > 1) throw new Error(`Multiple skill definitions found for ${id}`);
    const row = rows[0];
    if (!row) throw new Error(`Skill catalog entry ${id} is missing`);
    if (row.valueKind !== "number" && row.valueKind !== "string") {
      throw new Error(`Skill ${id} valueKind is invalid`);
    }
    return new SkillDefinition(
      row.id,
      row.title,
      row.groupKey,
      row.sortOrder,
      row.weight,
      row.image,
      row.valueKind,
    );
  }

  async level(level: number): Promise<LevelBoundary> {
    const releaseId = await this.revision.requireId();
    const rows = await this.database
      .session()
      .select()
      .from(levelBoundaries)
      .where(and(eq(levelBoundaries.releaseId, releaseId), eq(levelBoundaries.level, level)));
    if (rows.length > 1) throw new Error(`Multiple level boundaries found for ${level}`);
    const row = rows[0];
    if (!row) throw new Error(`Level catalog entry ${level} is missing`);
    return new LevelBoundary(
      row.level,
      row.expMin,
      row.expMax,
      row.bagCnt,
      row.honorRank,
      row.honorMin,
      row.honorMax,
      row.honorStatus,
    );
  }

  async appearance(kind: number, gender: number): Promise<AppearancePreset> {
    const releaseId = await this.revision.requireId();
    const rows = await this.database
      .session()
      .select()
      .from(appearancePresets)
      .where(
        and(
          eq(appearancePresets.releaseId, releaseId),
          eq(appearancePresets.kind, kind),
          eq(appearancePresets.gender, gender),
        ),
      );
    if (rows.length > 1) {
      throw new Error(`Multiple appearance presets found for kind ${kind} gender ${gender}`);
    }
    const row = rows[0];
    if (!row) throw new Error(`Appearance catalog entry kind ${kind} gender ${gender} is missing`);
    return new AppearancePreset(row.kind, row.gender, row.avatarBig, row.avatarSmall);
  }

  async hudDefaults(): Promise<HudDefaults> {
    const document = await this.requireGameWide("hud_defaults");
    const row = asRecord(document, "hud_defaults");
    return new HudDefaults(
      requireNumber(row, "fightId"),
      requireNumber(row, "gagTime"),
      requireNumber(row, "mpTime"),
      requireNumber(row, "epicValue"),
      requireNumber(row, "expStatus"),
      requireNumber(row, "revenge"),
      requireNumber(row, "revengeMin"),
      requireString(row, "revengeMax"),
      requireNumber(row, "revengeStatus"),
      requireNumber(row, "energyPercentMax"),
      requireNumber(row, "energyPercentCurrent"),
      requireNumber(row, "injuryTime"),
      requireNumber(row, "injuryArtikulId"),
    );
  }

  async chrome(): Promise<BootstrapChrome> {
    const chrome = await this.requireGameWide("chrome");
    const welcome = await this.requireGameWide("welcome_message");
    const welcomeRow = asRecord(welcome, "welcome_message");
    return new BootstrapChrome(asRecord(chrome, "chrome"), requireString(welcomeRow, "template"));
  }

  async commonConf(): Promise<CommonConfBlock> {
    const document = await this.requireGameWide("common_conf");
    const row = asRecord(document, "common_conf");
    if (row.status !== 100) throw new Error("common_conf status must be 100");
    return row as CommonConfBlock;
  }

  private async requireGameWide(
    documentKey: "hud_defaults" | "chrome" | "common_conf" | "welcome_message",
  ): Promise<unknown> {
    const releaseId = await this.revision.requireId();
    const rows = await this.database
      .session()
      .select()
      .from(gameWideDocuments)
      .where(
        and(
          eq(gameWideDocuments.releaseId, releaseId),
          eq(gameWideDocuments.documentKey, documentKey),
        ),
      );
    if (rows.length > 1) throw new Error(`Multiple game-wide documents found for ${documentKey}`);
    const row = rows[0];
    if (!row) throw new Error(`Game-wide catalog document ${documentKey} is missing`);
    return row.document;
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${key} must be a finite number`);
  }
  return value;
}

function requireString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || !value) throw new Error(`${key} is required`);
  return value;
}
