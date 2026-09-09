import path from "node:path";
import { BotDefinition } from "../../src/modules/catalog/domain/bot-definition.ts";
import { BotLootEntry } from "../../src/modules/catalog/domain/bot-loot-entry.ts";
import { BotReward } from "../../src/modules/catalog/domain/bot-reward.ts";
import { HuntLook } from "../../src/modules/catalog/domain/hunt-look.ts";
import type { BotDocument } from "../../src/modules/content/domain/content-document.ts";
import { loadContentBundleFile } from "../../src/modules/content/infrastructure/load-content-bundle-file.ts";

const playable = loadContentBundleFile(path.resolve(process.cwd(), "content/playable-slice.json"));

export function playableHuntBot(): BotDefinition {
  const spawn = playable.huntSpawns[0];
  if (!spawn) throw new Error("Playable slice has no hunt spawns");
  const document = playable.bots.find((bot) => bot.id === spawn.botId);
  if (!document) throw new Error(`Playable slice is missing bot ${spawn.botId}`);
  return botDefinitionFromDocument(document);
}

function botDefinitionFromDocument(document: BotDocument): BotDefinition {
  return new BotDefinition(
    document.id,
    document.title,
    document.level,
    document.maxHp,
    document.strength,
    new HuntLook(
      document.hunt.nick,
      document.hunt.swf,
      document.hunt.scale,
      document.hunt.fps,
      document.hunt.speed,
      document.hunt.avatar,
      document.hunt.kind,
      document.hunt.hideOnMap,
      document.hunt.sk,
      document.hunt.body,
    ),
    new BotReward(
      document.baseExp,
      document.moneyMin,
      document.moneyMax,
      document.lootDropCnt,
      document.lootBonusChance,
      document.lootBonusMin,
      document.lootBonusMax,
      document.lootNothingWeight,
      document.lootEntries.map(
        (entry) =>
          new BotLootEntry(entry.artikulId, entry.dropWeight, entry.countMin, entry.countMax),
      ),
    ),
  );
}
