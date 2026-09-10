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
import { collectStoreIssues } from "./collect-store-issues.ts";
import { collectReputationIssues } from "./collect-reputation-issues.ts";
import { collectProfessionIssues, overlayProfessionInfo } from "./collect-profession-issues.ts";
import { collectSetIssues } from "./collect-set-issues.ts";
import { collectUpgradeIssues } from "./collect-upgrade-issues.ts";
import { collectUseIssues } from "./collect-use-issues.ts";
import { collectDungeonIssues } from "./collect-dungeon-issues.ts";
import { collectBattlegroundIssues } from "./collect-battleground-issues.ts";
import { collectBotSpellIssues } from "./collect-bot-spell-issues.ts";

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
  "INJ_PROB",
  "BLOK",
  "BLOK_VISUAL",
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
      "area_link",
      bundle.areaLinks.map((link) => `${link.fromAreaId}:${link.itemId}`),
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
    for (const area of bundle.areas) {
      if (area.parentId && !areaIds.has(area.parentId)) {
        issues.push(`area ${area.id} parent ${area.parentId} is not in the bundle`);
      }
    }
    for (const link of bundle.areaLinks) {
      if (!areaIds.has(link.fromAreaId)) {
        issues.push(`area_link ${link.fromAreaId}:${link.itemId} from-area is missing`);
      }
      if (!areaIds.has(link.toAreaId)) {
        issues.push(
          `area_link ${link.fromAreaId}:${link.itemId} to-area ${link.toAreaId} is missing`,
        );
      }
      if (link.toId !== link.toAreaId) {
        issues.push(`area_link ${link.fromAreaId}:${link.itemId} toId does not match toAreaId`);
      }
      if (link.href.form.area_id !== Number(link.toAreaId)) {
        issues.push(
          `area_link ${link.fromAreaId}:${link.itemId} href area_id does not match toAreaId`,
        );
      }
    }
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
      if (!Number.isInteger(artifact.priceMinor) || artifact.priceMinor < 0) {
        issues.push(`artifact ${artifact.id} priceMinor is invalid`);
      }
      if (!Number.isInteger(artifact.flags) || artifact.flags < 0) {
        issues.push(`artifact ${artifact.id} flags are invalid`);
      }
      if (!Number.isInteger(artifact.bagStack) || artifact.bagStack < 1) {
        issues.push(`artifact ${artifact.id} bagStack is invalid`);
      }
      if (!Number.isInteger(artifact.durability) || artifact.durability < 0) {
        issues.push(`artifact ${artifact.id} durability is invalid`);
      }
      if (!Number.isInteger(artifact.durabilityMax) || artifact.durabilityMax < 0) {
        issues.push(`artifact ${artifact.id} durabilityMax is invalid`);
      }
      if (artifact.durability > artifact.durabilityMax) {
        issues.push(`artifact ${artifact.id} durability exceeds durabilityMax`);
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
    issues.push(...collectFightSpellIssues(bundle.artifacts));
    issues.push(...collectBotLootIssues(bundle));
    issues.push(...collectStoreIssues(bundle));
    issues.push(...collectReputationIssues(bundle));
    issues.push(...collectProfessionIssues(bundle));
    issues.push(...collectUpgradeIssues(bundle));
    issues.push(...collectSetIssues(bundle));
    issues.push(...collectUseIssues(bundle));
    issues.push(...collectBotSpellIssues(bundle));
    issues.push(...collectDungeonIssues(bundle));
    issues.push(...collectBattlegroundIssues(bundle));
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

    const commonConf = overlayProfessionInfo(bundle);
    const entries: ContentEntry[] = [
      ...bundle.artifacts.map((document) => entry("artifact", String(document.id), document)),
      ...bundle.bots.map((document) => entry("bot", String(document.id), document)),
      ...bundle.areas.map((document) => entry("area", document.id, document)),
      ...bundle.areaLinks.map((document) =>
        entry("area_link", `${document.fromAreaId}:${document.itemId}`, document),
      ),
      ...bundle.huntSpawns.map((document) => entry("hunt_spawn", String(document.id), document)),
      ...bundle.dungeons.map((document) => entry("dungeon", String(document.artikulId), document)),
      ...bundle.battlegrounds.map((document) =>
        entry("battleground", `${document.type}|${document.id}`, document),
      ),
      ...bundle.storeTypes.map((document) =>
        entry("store_type", `${document.areaId}:${document.typeId}`, document),
      ),
      ...bundle.storeLots.map((document) =>
        entry("store_lot", `${document.areaId}:${document.lotId}`, document),
      ),
      ...bundle.reputationTracks.map((document) =>
        entry("reputation_track", String(document.objectId), document),
      ),
      ...bundle.professions.map((document) => entry("profession", String(document.id), document)),
      ...bundle.bonuses.map((document) => entry("bonus", String(document.id), document)),
      ...bundle.useScripts.map((document) =>
        entry("use_script", String(document.bonusId), document),
      ),
      ...bundle.skills.map((document) => entry("skill", document.id, document)),
      ...bundle.levels.map((document) => entry("level", String(document.level), document)),
      ...bundle.appearances.map((document) =>
        entry("appearance", `${document.kind}:${document.gender}`, document),
      ),
      entry("hud_defaults", "hud_defaults", bundle.hudDefaults),
      entry("chrome", "chrome", bundle.chrome),
      entry("common_conf", "common_conf", commonConf),
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
      areaLinks: bundle.areaLinks,
      huntSpawns: bundle.huntSpawns,
      dungeons: bundle.dungeons,
      battlegrounds: bundle.battlegrounds,
      storeTypes: bundle.storeTypes,
      storeLots: bundle.storeLots,
      reputationTracks: bundle.reputationTracks,
      professions: bundle.professions,
      bonuses: bundle.bonuses,
      useScripts: bundle.useScripts,
      skills: bundle.skills,
      levels: bundle.levels,
      appearances: bundle.appearances,
      hudDefaults: bundle.hudDefaults,
      chrome: bundle.chrome,
      commonConf,
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

function collectFightSpellIssues(artifacts: ContentBundle["artifacts"]): readonly string[] {
  const issues: string[] = [];
  const byId = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  const elixir = byId.get(93);
  if (!elixir?.extra.spell) {
    issues.push("artifact 93 is missing dump-proven extra.spell");
  } else {
    if (elixir.extra.spell.cooldown !== 20) {
      issues.push("artifact 93 spell cooldown must be 20");
    }
    if (!elixir.extra.spell.effects.some((effect) => effect.kind === 2)) {
      issues.push("artifact 93 spell must include a kind-2 heal effect");
    }
  }
  const orb = byId.get(99);
  if (!orb?.extra.spell) {
    issues.push("artifact 99 is missing dump-proven extra.spell");
  } else if (!orb.extra.spell.effects.some((effect) => effect.kind === 3)) {
    issues.push("artifact 99 spell must include a kind-3 charging effect");
  }
  const meat = byId.get(77);
  if (meat?.extra.spell) issues.push("artifact 77 must not carry a fight spell blob");
  const glove = byId.get(9095);
  const socketIds = glove?.extra.spells?.map((socket) => socket.artikul_id0) ?? [];
  if (!glove?.extra.spells) {
    issues.push("artifact 9095 is missing dump-proven extra.spells sockets");
  } else if (socketIds.join(",") !== "9098,9100,9099" && socketIds.join(",") !== "9098,9099,9100") {
    issues.push("artifact 9095 sockets must be artikul_id0 9098/9100/9099");
  }
  if (!glove?.extra.hits || glove.extra.hits.length !== 8) {
    issues.push("artifact 9095 is missing dump-proven extra.hits");
  }
  for (const spellId of [9098, 9100, 9099]) {
    const spell = byId.get(spellId);
    if (!spell?.extra.spell) {
      issues.push(`artifact ${spellId} is missing dump-proven extra.spell`);
    }
  }
  return issues;
}

function collectBotLootIssues(bundle: ContentBundle): readonly string[] {
  const issues: string[] = [];
  const artifactIds = new Set(bundle.artifacts.map((artifact) => artifact.id));
  for (const bot of bundle.bots) {
    const seen = new Set<number>();
    for (const entry of bot.lootEntries) {
      if (seen.has(entry.artikulId)) {
        issues.push(`bot ${bot.id} has duplicate loot artikul ${entry.artikulId}`);
      }
      seen.add(entry.artikulId);
      if (!artifactIds.has(entry.artikulId)) {
        issues.push(`bot ${bot.id} loot artikul ${entry.artikulId} is not in the bundle`);
      }
    }
  }
  return issues;
}

function collectDuplicateIds(issues: string[], type: string, keys: readonly string[]): void {
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) issues.push(`duplicate ${type} id ${key}`);
    seen.add(key);
  }
}
