import { digestCanonical } from "../domain/canonical-digest.ts";
import { BOOTSTRAP_CHROME_REQUIRED_KEYS } from "../domain/bootstrap-content.ts";
import { collectProgressionCurveIssues } from "../domain/progression-curve.ts";
import {
  CONTENT_VALIDATOR_VERSION,
  PLAYABLE_SLICE_SCHEMA_VERSION,
  type ContentBundle,
  type ContentEntry,
  type ValidatedContentBundle,
} from "../domain/content-document.ts";
import { ContentValidationError } from "./content-validation-error.ts";

const REQUIRED_SKILL_IDS = [
  "HPREG",
  "ORATORY",
  "STR",
  "RAG",
  "DEX",
  "DEF",
  "VIT",
  "MPMAX",
  "MONEYMOD",
] as const;

export class ContentValidator {
  validate(bundle: ContentBundle): ValidatedContentBundle {
    const issues: string[] = [];
    if (bundle.schemaVersion !== PLAYABLE_SLICE_SCHEMA_VERSION) {
      issues.push(`unsupported schema version ${bundle.schemaVersion}`);
    }
    collectDuplicateIds(
      issues,
      "artifact",
      bundle.artifacts.map((artifact) => String(artifact.id)),
    );
    collectDuplicateIds(
      issues,
      "bot",
      bundle.bots.map((bot) => String(bot.id)),
    );
    collectDuplicateIds(
      issues,
      "area",
      bundle.areas.map((area) => area.id),
    );
    collectDuplicateIds(
      issues,
      "hunt_spawn",
      bundle.huntSpawns.map((spawn) => String(spawn.id)),
    );
    collectDuplicateIds(
      issues,
      "skill",
      bundle.skills.map((skill) => skill.id),
    );
    collectDuplicateIds(
      issues,
      "level",
      bundle.levels.map((level) => String(level.level)),
    );
    collectDuplicateIds(
      issues,
      "appearance",
      bundle.appearances.map((row) => `${row.kind}:${row.gender}`),
    );
    const areaIds = new Set(bundle.areas.map((area) => area.id));
    const botIds = new Set(bundle.bots.map((bot) => bot.id));
    for (const spawn of bundle.huntSpawns) {
      if (!areaIds.has(spawn.areaId)) {
        issues.push(`hunt_spawn ${spawn.id} references missing area ${spawn.areaId}`);
      }
      if (!botIds.has(spawn.botId)) {
        issues.push(`hunt_spawn ${spawn.id} references missing bot ${spawn.botId}`);
      }
      const areaNumber = Number(spawn.areaId);
      if (!Number.isInteger(areaNumber) || areaNumber <= 0) {
        issues.push(`hunt_spawn ${spawn.id} area ${spawn.areaId} is not a numeric area id`);
      } else {
        const min = areaNumber * 100;
        const max = min + 99;
        if (spawn.id < min || spawn.id > max) {
          issues.push(`hunt_spawn ${spawn.id} is outside map hunt range ${min}..${max}`);
        }
      }
    }
    const skillIds = new Set(bundle.skills.map((skill) => skill.id));
    for (const skillId of REQUIRED_SKILL_IDS) {
      if (!skillIds.has(skillId)) issues.push(`missing required skill ${skillId}`);
    }
    for (const artifact of bundle.artifacts) {
      if (artifact.levelMax > 0 && artifact.levelMax < artifact.levelMin) {
        issues.push(`artifact ${artifact.id} levelMax is below levelMin`);
      }
      const artifactSkills = new Set<string>();
      for (const skill of artifact.skills) {
        if (!skillIds.has(skill.id)) {
          issues.push(`artifact ${artifact.id} references missing skill ${skill.id}`);
        }
        if (artifactSkills.has(skill.id)) {
          issues.push(`artifact ${artifact.id} has duplicate skill ${skill.id}`);
        }
        artifactSkills.add(skill.id);
      }
    }
    if (!bundle.levels.some((level) => level.level === 1)) {
      issues.push("level 1 boundary is required");
    }
    issues.push(...collectProgressionCurveIssues(bundle.levels, skillIds));
    if (!bundle.appearances.some((row) => row.kind === 1 && row.gender === 1)) {
      issues.push("appearance for kind 1 gender 1 is required");
    }
    if (!bundle.welcomeMessage.template.includes("{nick}")) {
      issues.push("welcome template must contain {nick}");
    }
    for (const key of BOOTSTRAP_CHROME_REQUIRED_KEYS) {
      if (!(key in bundle.chrome)) issues.push(`chrome is missing ${key}`);
    }
    if (issues.length > 0) throw new ContentValidationError(issues);

    const entries: ContentEntry[] = [
      ...bundle.artifacts.map((document) => entry("artifact", String(document.id), document)),
      ...bundle.bots.map((document) => entry("bot", String(document.id), document)),
      ...bundle.areas.map((document) => entry("area", document.id, document)),
      ...bundle.huntSpawns.map((document) => entry("hunt_spawn", String(document.id), document)),
      ...bundle.skills.map((document) => entry("skill", document.id, document)),
      ...bundle.levels.map((document) => entry("level", String(document.level), document)),
      ...bundle.appearances.map((document) =>
        entry("appearance", `${document.kind}:${document.gender}`, document),
      ),
      entry("hud_defaults", "hud_defaults", bundle.hudDefaults),
      entry("chrome", "chrome", bundle.chrome),
      entry("common_conf", "common_conf", bundle.commonConf),
      entry("welcome_message", "welcome_message", bundle.welcomeMessage),
    ].sort((left, right) => {
      const typeOrder = left.type.localeCompare(right.type);
      return typeOrder !== 0 ? typeOrder : left.key.localeCompare(right.key);
    });
    return {
      schemaVersion: PLAYABLE_SLICE_SCHEMA_VERSION,
      validatorVersion: CONTENT_VALIDATOR_VERSION,
      checksum: digestCanonical({
        schemaVersion: PLAYABLE_SLICE_SCHEMA_VERSION,
        validatorVersion: CONTENT_VALIDATOR_VERSION,
        entries: entries.map((item) => ({
          type: item.type,
          key: item.key,
          digest: item.digest,
        })),
      }),
      artifacts: bundle.artifacts,
      bots: bundle.bots,
      areas: bundle.areas,
      huntSpawns: bundle.huntSpawns,
      skills: bundle.skills,
      levels: bundle.levels,
      appearances: bundle.appearances,
      hudDefaults: bundle.hudDefaults,
      chrome: bundle.chrome,
      commonConf: bundle.commonConf,
      welcomeMessage: bundle.welcomeMessage,
      entries,
    };
  }
}

function entry(
  type: ContentEntry["type"],
  key: string,
  document: ContentEntry["document"],
): ContentEntry {
  return { type, key, digest: digestCanonical(document), document };
}

function collectDuplicateIds(issues: string[], type: string, keys: readonly string[]): void {
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) issues.push(`duplicate ${type} id ${key}`);
    seen.add(key);
  }
}
