import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const maxLines = 400;
const reviewThreshold = 250;
const lineJustifications: Readonly<Record<string, string>> = {
  "src/modules/character/application/character-service.ts":
    "Character application facade: progression, resources, money, reputation, learn-bonus, location, and presence",
  "src/modules/world/domain/hunt-wander.ts":
    "Hunt live motion: route, zone, home park, lock freeze, and respawn hide",
  "src/modules/content/domain/parse-content-bundle.ts":
    "Zod playable-slice document including store lots, reputation, bonuses, use scripts, bot spell books, and hunt wander fields",
  "src/modules/content/domain/content-document.ts":
    "Playable bundle DTO including store, reputation, bonuses, use scripts, artifacts, bot spell books, areas, hunt wander, and bootstrap documents",
  "src/modules/character/domain/hero.ts":
    "Hero aggregate owns vitals, money, location lock, and CMB-04 ghost/injury clock",
  "src/modules/combat/application/combat-service.ts":
    "Process-local hunt/friendly service: start/join/auth/resume/poll, CMB-02 casts, CMB-03 loot/exit take and leave ack",
  "src/modules/combat/domain/battle.ts":
    "Hunt/friendly Battle owns FightDuel pairing, CMB-08 shuffle/waiter handoff, melee, CMB-06 bot turns, casts, and CMB-04 resume",
  "src/modules/content/application/content-validator.ts":
    "Single bundle completeness gate including store 504, reputation, set bonuses, USE representatives, fight extra blobs, bot loot, and bot spell books",
  "src/modules/inventory/domain/inventory-service.ts":
    "Bag/pocket/paperdoll mutations plus CMB-03 grantToBag, INV-05 repair, INV-06 upgrade, INV-07 set-bonus, and INV-08 USE/drink",
  "src/modules/catalog/infrastructure/schema.ts":
    "Catalog projection tables including bot loot, store, reputation, bonuses, and use_scripts",
  "src/modules/catalog/infrastructure/postgres-catalog.ts":
    "Active-release catalog reads for artifacts, bots, spell books, skills, store, reputation, bonuses, and use scripts",
  "src/modules/jugger-wire/application/bootstrap-read-model.ts":
    "Flat OA bootstrap/mutation blocks including drink purge, USE mutation, and CMB-04 init2 fight|conf",
};
const multiExportAllowlist: readonly string[] = [];
const amfValueAllowPrefix = "src/modules/jugger-wire/amf/";

const files = collectTsFiles(srcRoot);
const failures: string[] = [];
const review: string[] = [];

for (const file of files) {
  const relative = path.relative(path.resolve(srcRoot, ".."), file).split(path.sep).join("/");
  const source = fs.readFileSync(file, "utf8");
  const lineCount = source.split(/\r?\n/).length;
  if (lineCount > maxLines) {
    failures.push(`${relative}: ${lineCount} lines exceeds the 400-line handwritten limit`);
  } else if (lineCount > reviewThreshold) {
    const justification = lineJustifications[relative];
    if (!justification) {
      failures.push(
        `${relative}: ${lineCount} lines exceeds the 250-line review threshold without a justification`,
      );
    } else {
      review.push(`${relative}: ${lineCount} lines — ${justification}`);
    }
  }

  const exportCount = countPrimaryExports(source);
  if (exportCount > 1 && !multiExportAllowlist.includes(relative)) {
    failures.push(`${relative}: ${exportCount} primary exported classes/interfaces`);
  }

  if (/\bAmfValue\b/.test(source) && !relative.startsWith(amfValueAllowPrefix)) {
    failures.push(`${relative}: AmfValue is only allowed in jugger-wire/amf`);
  }

  if (/\bimport\s*\(/.test(source)) {
    failures.push(`${relative}: dynamic import() is forbidden in production`);
  }

  if (/\bexport class Memory/.test(source) || /\bclass Memory/.test(source)) {
    failures.push(`${relative}: production Memory* implementations are forbidden`);
  }

  const inDomainOrApplication = /\/(domain|application)\//.test(relative);
  if (inDomainOrApplication) {
    if (/\bfrom ["']fastify["']/.test(source) || /from ["']@fastify\//.test(source)) {
      failures.push(`${relative}: Fastify imports are forbidden in domain/application`);
    }
    if (/\bfrom ["']drizzle-orm/.test(source)) {
      failures.push(`${relative}: Drizzle imports are forbidden in domain/application`);
    }
    if (/jugger-wire\/amf\//.test(source)) {
      failures.push(`${relative}: AMF imports are forbidden in domain/application`);
    }
  }
}

if (review.length > 0) {
  process.stdout.write(`${review.join("\n")}\n`);
}
if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}

function collectTsFiles(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts")) files.push(fullPath);
  }
  return files;
}

function countPrimaryExports(source: string): number {
  const classes = source.match(/^export class /gm)?.length ?? 0;
  const interfaces = source.match(/^export interface /gm)?.length ?? 0;
  return classes + interfaces;
}
