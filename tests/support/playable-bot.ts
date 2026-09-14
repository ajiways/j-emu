import path from "node:path";
import { BotDefinition } from "../../src/modules/catalog/domain/bot-definition.ts";
import { BotLootEntry } from "../../src/modules/catalog/domain/bot-loot-entry.ts";
import { BotReward } from "../../src/modules/catalog/domain/bot-reward.ts";
import { BotSpellBook } from "../../src/modules/catalog/domain/bot-spell-book.ts";
import { HuntLook } from "../../src/modules/catalog/domain/hunt-look.ts";
import { artifactExtraFromJson } from "../../src/modules/catalog/infrastructure/artifact-extra-from-json.ts";
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

export function playableHuntMeatLootDraw(): number[] {
  return lootDrawPastBonus(playableHuntBot().reward, 77);
}

export function playableHuntMeatSettlementDraw(): number[] {
  return [0, ...playableHuntMeatLootDraw()];
}

function lootDrawPastBonus(reward: BotReward, artikulId: number): number[] {
  const pool = reward.lootEntries.filter((entry) => entry.dropWeight > 0);
  const weightSum = pool.reduce((sum, entry) => sum + entry.dropWeight, 0);
  const total = weightSum + reward.lootNothingWeight;
  let prefix = 0;
  const picked = pool.find((entry) => {
    if (entry.artikulId === artikulId) return true;
    prefix += entry.dropWeight;
    return false;
  });
  if (!picked) throw new Error(`Playable hunt loot is missing artikul ${artikulId}`);
  const unit = (reward.lootNothingWeight + prefix + picked.dropWeight / 2) / total;
  if (unit < 0 || unit >= 1) throw new Error(`Loot unit ${unit} is outside [0, 1)`);
  const draws = [unit, picked.countMin];
  if (reward.lootBonusChance > 0) draws.unshift(reward.lootBonusChance);
  return draws;
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
    new BotSpellBook(
      document.spellBook.nothingWeight,
      document.spellBook.spells.map((card) => {
        const extra = artifactExtraFromJson(card.artikulId, { spell: card.spell });
        if (!extra.spell) {
          throw new Error(
            `Playable bot ${document.id} spell ${card.artikulId} is missing extra.spell`,
          );
        }
        return {
          artikulId: card.artikulId,
          slot: card.slot,
          weight: card.weight,
          maxCasts: card.maxCasts,
          gate: card.gate,
          hpPct: card.hpPct,
          spell: extra.spell,
        };
      }),
    ),
  );
}
