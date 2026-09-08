import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type {
  AppearanceDocument,
  BootstrapChromeDocument,
  CommonConfBlock,
  HudDefaultsDocument,
  LevelBoundaryDocument,
  SkillDocument,
  WelcomeMessageDocument,
} from "../../content/domain/bootstrap-content.ts";
import type { ArtifactDocument, BotDocument } from "../../content/domain/content-document.ts";
import type { CatalogMaterialization, CatalogProjection } from "../ports/catalog-projection.ts";
import {
  appearancePresets,
  artifacts,
  bots,
  gameWideDocuments,
  levelBoundaries,
  skillDefinitions,
} from "./schema.ts";

export class PostgresCatalogProjection implements CatalogProjection {
  constructor(private readonly database: PostgresDatabase) {}

  async materialize(releaseId: string, documents: CatalogMaterialization): Promise<void> {
    const session = this.database.session();
    await insertArtifacts(session, releaseId, documents.artifacts);
    await insertBots(session, releaseId, documents.bots);
    await insertSkills(session, releaseId, documents.skills);
    await insertLevels(session, releaseId, documents.levels);
    await insertAppearances(session, releaseId, documents.appearances);
    await session
      .insert(gameWideDocuments)
      .values([
        gameWideRow(releaseId, "hud_defaults", documents.hudDefaults),
        gameWideRow(releaseId, "chrome", documents.chrome),
        gameWideRow(releaseId, "common_conf", documents.commonConf),
        gameWideRow(releaseId, "welcome_message", documents.welcomeMessage),
      ]);
  }
}

function gameWideRow(
  releaseId: string,
  documentKey: "hud_defaults" | "chrome" | "common_conf" | "welcome_message",
  document:
    HudDefaultsDocument | BootstrapChromeDocument | CommonConfBlock | WelcomeMessageDocument,
) {
  return { releaseId, documentKey, document };
}

async function insertArtifacts(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  rows: readonly ArtifactDocument[],
): Promise<void> {
  if (rows.length === 0) return;
  await session.insert(artifacts).values(
    rows.map((artifact) => ({
      releaseId,
      id: artifact.id,
      title: artifact.title,
      picture: artifact.picture,
      typeId: artifact.typeId,
      kindId: artifact.kindId,
      slotMask: artifact.slotMask,
      weight: artifact.weight,
      levelMin: artifact.levelMin,
      levelMax: artifact.levelMax,
      gender: artifact.gender,
      skills: artifact.skills,
    })),
  );
}

async function insertBots(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  rows: readonly BotDocument[],
): Promise<void> {
  if (rows.length === 0) return;
  await session.insert(bots).values(
    rows.map((bot) => ({
      releaseId,
      id: bot.id,
      title: bot.title,
      level: bot.level,
      maxHp: bot.maxHp,
      strength: bot.strength,
      huntNick: bot.hunt.nick,
      huntSwf: bot.hunt.swf,
      huntScale: bot.hunt.scale,
      huntFps: bot.hunt.fps,
      huntSpeed: bot.hunt.speed,
      huntAvatar: bot.hunt.avatar,
      huntKind: bot.hunt.kind,
      huntHideOnMap: bot.hunt.hideOnMap,
    })),
  );
}

async function insertSkills(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  rows: readonly SkillDocument[],
): Promise<void> {
  if (rows.length === 0) return;
  await session.insert(skillDefinitions).values(
    rows.map((skill) => ({
      releaseId,
      id: skill.id,
      title: skill.title,
      groupKey: skill.group,
      sortOrder: skill.order,
      weight: skill.weight,
      image: skill.image,
      valueKind: skill.valueKind,
    })),
  );
}

async function insertLevels(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  rows: readonly LevelBoundaryDocument[],
): Promise<void> {
  if (rows.length === 0) return;
  await session.insert(levelBoundaries).values(
    rows.map((level) => ({
      releaseId,
      level: level.level,
      expMin: level.expMin,
      expMax: level.expMax,
      bagCnt: level.bagCnt,
      honorRank: level.honorRank,
      honorMin: level.honorMin,
      honorMax: level.honorMax,
      honorStatus: level.honorStatus,
    })),
  );
}

async function insertAppearances(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  rows: readonly AppearanceDocument[],
): Promise<void> {
  if (rows.length === 0) return;
  await session.insert(appearancePresets).values(
    rows.map((row) => ({
      releaseId,
      kind: row.kind,
      gender: row.gender,
      avatarBig: row.avatarBig,
      avatarSmall: row.avatarSmall,
    })),
  );
}
