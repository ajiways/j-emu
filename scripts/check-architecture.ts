import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const maxLines = 400;
const reviewThreshold = 250;
const lineJustifications: Readonly<Record<string, string>> = {
  "src/app/composition-root.ts":
    "Wires identity through mail/auction/trade/chat/party/instance/battleground/professions/quests composition UoW and shared DelayScheduler sweeps",
  "src/app/quest-desk.ts":
    "Quest OA router: NPC board/dialog, book cancel, AREA waiting, script effects, and CMB-09 quest fight start",
  "src/modules/quests/application/quest-service.ts":
    "Quest application facade: board, dialog cursor, prior-gate signals, AREA waiting, flags, and bag sync",
  "src/modules/quests/infrastructure/postgres-quest-catalog.ts":
    "Active-release quest catalog reads for NPCs, authored quests, dialog, scripts, and AREA hotspots",
  "src/modules/quests/infrastructure/postgres-quest-rows.ts":
    "Quest projection row mapping for NPCs, goals, dialog steps, and script ops",
  "src/modules/quests/infrastructure/postgres-hero-quest-repository.ts":
    "Hero quest progress rows plus goals, facts, waiting, and FOR UPDATE lock",
  "src/modules/auction/infrastructure/postgres-listing-repository.ts":
    "Auction listing rows plus snapshot columns, search filters, and FOR UPDATE lock/sweep",
  "src/modules/jugger-wire/jugger-wire-module.ts":
    "HTTP/TCP servers and OA command module factory including mail, auction, trade, chat, party, instance, battleground, professions, craft, and quest ports",
  "src/modules/jugger-wire/registry/jugger-command-module.ts":
    "Static OA command constructors including mail, auction, trade, chat, party, instance, battleground, live user|professions, assistant|*, craft|*, and quest|*",
  "src/modules/character/application/character-service.ts":
    "Character application facade: progression, resources, money, reputation, profession licenses, craft XP bump, learn-bonus, location, and presence",
  "src/modules/character/infrastructure/postgres-hero-repository.ts":
    "Hero rows including location lock, instance copy shard, and CMB-04 ghost/injury clock",
  "src/modules/world/domain/hunt-wander.ts":
    "Hunt live motion: route, zone, home park, lock freeze, and respawn hide",
  "src/modules/content/domain/parse-content-bundle.ts":
    "Zod playable-slice document including store lot pay/requires, reputation, professions, assistants, farms, craft recipes, bonuses, use scripts, bot spell books, hunt wander fields, dungeons, battlegrounds, NPCs, and quests",
  "src/modules/content/domain/content-playable-entities.ts":
    "Playable entity DTOs extracted from the bundle document: artifacts, bots, areas, hunt, store, bonuses, and use scripts",
  "src/modules/character/domain/hero.ts":
    "Hero aggregate owns vitals, money, location lock, instance copy presence, and CMB-04 ghost/injury clock",
  "src/modules/combat/application/combat-service.ts":
    "Process-local hunt/friendly service: start/join/auth/resume/poll, CMB-02 casts, CMB-03 loot/exit take and leave ack",
  "src/modules/combat/domain/battle.ts":
    "Hunt/friendly Battle owns FightDuel pairing, CMB-08 shuffle/waiter handoff, melee, CMB-06 bot turns, casts, and CMB-04 resume",
  "src/modules/content/application/content-validator.ts":
    "Single bundle completeness gate including store 504/552 pay and RANK, reputation, professions 2/6, assistant 3/13, farm 4 on area 500, craft recipe 61, set bonuses, USE representatives, fight extra blobs, bot loot, bot spell books, dungeon definitions, battlegrounds, NPC 271, and three engine quests",
  "src/modules/inventory/domain/inventory-service.ts":
    "Bag/pocket/paperdoll mutations plus CMB-03 grantToBag, INV-05 repair, INV-06 upgrade, INV-07 set-bonus, INV-08 USE/drink, ECO-02 barter consume-by-artikul, MAIL-02 instance take/snapshot grant, AUC-01 auction take, and TRD-01 trade take",
  "src/modules/mail/infrastructure/postgres-letter-repository.ts":
    "Mail letter rows plus attachment snapshots, FOR UPDATE pick/sweep, and markPicked",
  "src/modules/catalog/infrastructure/schema.ts":
    "Catalog projection tables including bot loot, store pay/requires, reputation, bonuses, and use_scripts",
  "src/modules/catalog/infrastructure/postgres-catalog.ts":
    "Active-release catalog reads for artifacts, bots, spell books, skills, store, reputation, professions, assistants, farms, craft recipes, bonuses, and use scripts",
  "src/modules/catalog/infrastructure/postgres-catalog-projection.ts":
    "Active-release materialization for artifacts, bots, store, reputation, professions, assistants, farms, craft recipes, dungeon, and battleground catalog rows",
  "src/modules/jugger-wire/application/bootstrap-read-model.ts":
    "Flat OA bootstrap/mutation blocks including drink purge, USE mutation, CMB-04 init2 fight|conf, SOC-02 party restore, dungeon hunt, live user|professions, live assistant|farm_info, and live book trio",
  "src/modules/professions/application/professions-service.ts":
    "PRF-02 assistant OA mutations plus sweeper finishDue loot/mastery/stock under the professions UoW",
  "src/modules/professions/domain/farm-jobs.ts":
    "Dump-proven farm assignment, cycle finish, stock decrement/respawn, and FREE sentinel insert",
  "src/app/chat-desk.ts":
    "Player chat add plus area/private/party fan-out and hunt/loot system lines",
  "src/app/instance-desk.ts":
    "Dungeon enter/leave/expiry kick plus auto-party chrome and location push",
  "src/app/party-desk.ts":
    "Party OA router: create/kick/leave/disband/leader/settings, bag-lock, and dump chrome bag",
  "src/app/party-notify.ts":
    "Party esrv system lines: membership, give, lottery, group loot, and HELP ACTION",
  "src/app/party-bag-ops.ts":
    "Party bag give/drop/dump plus lottery rounds under the party UoW lock",
  "src/app/hunt-fight-settlement.ts":
    "Hunt finish UoW: EXP/money/loot plus party money split, deferred bag deposit, and bestiary kill credit",
  "src/app/party-join-ops.ts":
    "Party invite/confirm/join windows and dump join_confirm pending path",
  "src/app/battleground-match-runtime.ts":
    "Раскоп match: create bg copy, teleport sides, ATTACK PvP, score/timeout finish, history, and kick 500",
  "src/modules/battleground/domain/battleground-wire.ts":
    "Dump list overlay, invite window, instance map, live/finish stats, typed history, and leader-rating chrome",
  "src/modules/party/application/party-service.ts":
    "Party membership mutations: create/kick/leave/disband/leader/settings with FOR UPDATE",
  "src/modules/party/application/party-join-service.ts":
    "Party invite/confirm/join/search-join pending under the same UoW lock",
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
