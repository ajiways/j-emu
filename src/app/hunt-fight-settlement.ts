import type { ArtifactDefinition } from "../modules/catalog/domain/artifact-definition.ts";
import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { CharacterMoney } from "../modules/character/ports/character-money.ts";
import type { CharacterProgression } from "../modules/character/ports/character-progression.ts";
import type { CharacterResources } from "../modules/character/ports/character-resources.ts";
import type { FightArtikulListWire } from "../modules/combat/domain/fight-loot-block.ts";
import { fightLootBlock, type FightLootBlock } from "../modules/combat/domain/fight-loot-block.ts";
import {
  goldToMinor,
  goldWireString,
  rollMoneyGold,
} from "../modules/combat/domain/fight-money.ts";
import type { FightOutcomeSnapshot } from "../modules/combat/domain/fight-outcome-snapshot.ts";
import {
  overlevel,
  scaleMoneyReward,
  worldLootAllowed,
} from "../modules/combat/domain/overlevel.ts";
import type { RandomSource } from "../modules/combat/domain/random-source.ts";
import { rollBotLoot } from "../modules/combat/domain/roll-bot-loot.ts";
import {
  rankDamageShares,
  splitFightExperience,
} from "../modules/combat/domain/split-fight-experience.ts";
import type {
  FightSettlement,
  HumanLeftSnapshot,
} from "../modules/combat/ports/fight-settlement.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";

type SettlementCharacters = CharacterResources & CharacterProgression & CharacterMoney;

export class HuntFightSettlement implements FightSettlement {
  private readonly finished = new Map<string, Map<number, FightLootBlock>>();
  private readonly left = new Set<string>();

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly catalog: Catalog,
    private readonly characters: SettlementCharacters,
    private readonly inventory: InventoryService,
    private readonly random: RandomSource,
  ) {}

  persistHumanLeft(snapshot: HumanLeftSnapshot): Promise<void> {
    const key = `${snapshot.fightId}:${snapshot.accountId}`;
    if (this.left.has(key)) return Promise.resolve();
    this.left.add(key);
    return this.unitOfWork.run(async () => {
      await persistFightHp(this.characters, snapshot.characterId, snapshot.hp);
      await this.inventory.refillPocketAfterFight({
        characterId: snapshot.characterId,
        cells: snapshot.pocket,
      });
    });
  }

  async persistFinished(
    outcome: FightOutcomeSnapshot,
  ): Promise<ReadonlyMap<number, FightLootBlock>> {
    const cached = this.finished.get(outcome.fightId);
    if (cached) return cached;
    const bot = await this.catalog.bot(outcome.botId);
    if (!bot) throw new Error(`Bot catalog entry ${outcome.botId} is missing`);
    const win = outcome.kind === "win";
    const shares = outcome.humans.map((human) => ({
      characterId: human.characterId,
      damage: human.damageToBot,
      level: human.level,
    }));
    const experience = win
      ? splitFightExperience(bot.reward.baseExp, outcome.botLevel, shares)
      : new Map<number, number>();
    const top = win ? (rankDamageShares(shares)[0] ?? null) : null;
    const over = top ? overlevel(top.level, outcome.botLevel) : 0;
    let moneyMinor = 0;
    let rolled: readonly { artikulId: number; quantity: number }[] = [];
    if (win && top) {
      moneyMinor = goldToMinor(
        scaleMoneyReward(
          rollMoneyGold(bot.reward.moneyMin, bot.reward.moneyMax, this.random),
          over,
        ),
      );
      if (worldLootAllowed(over)) rolled = rollBotLoot(bot.reward, this.random);
    }
    const artikulList = await this.artikulList(rolled);
    const lootByAccount = new Map<number, FightLootBlock>();
    await this.unitOfWork.run(async () => {
      for (const human of outcome.humans) {
        const exp = experience.get(human.characterId) ?? 0;
        const isTop = top?.characterId === human.characterId;
        const goldMinor = isTop ? moneyMinor : 0;
        const drops = isTop ? rolled : [];
        if (!human.leftLive) {
          await persistFightHp(this.characters, human.characterId, human.hp);
          await this.inventory.refillPocketAfterFight({
            characterId: human.characterId,
            cells: human.pocket,
          });
        }
        if (exp >= 1) {
          await this.characters.grantExperience({
            characterId: human.characterId,
            operationId: `fight:${outcome.fightId}:${human.characterId}`,
            amount: exp,
          });
        }
        if (goldMinor >= 1) {
          await this.characters.creditMoney({
            characterId: human.characterId,
            minorUnits: goldMinor,
          });
        }
        for (const drop of drops) {
          await this.inventory.grantToBag({
            characterId: human.characterId,
            artifactId: drop.artikulId,
            quantity: drop.quantity,
          });
        }
        lootByAccount.set(
          human.accountId,
          fightLootBlock({
            fightId: outcome.fightId,
            experience: exp,
            money: goldWireString(goldMinor),
            items: drops.map((drop) => ({ artikul_id: drop.artikulId, amount: drop.quantity })),
            artikulList: isTop ? artikulList : [],
          }),
        );
      }
    });
    this.finished.set(outcome.fightId, lootByAccount);
    return lootByAccount;
  }

  private async artikulList(
    rolled: readonly { artikulId: number; quantity: number }[],
  ): Promise<readonly FightArtikulListWire[]> {
    const entries: FightArtikulListWire[] = [];
    for (const drop of rolled) {
      const definition = await this.catalog.artifact(drop.artikulId);
      if (!definition) throw new Error(`Artifact catalog entry ${drop.artikulId} is missing`);
      entries.push(artikulListEntry(definition));
    }
    return entries;
  }
}

function persistFightHp(
  characters: SettlementCharacters,
  characterId: number,
  hp: number,
): Promise<unknown> {
  if (hp === 0) return characters.noteDefeat({ characterId, hp: 0 });
  return characters.noteHp({ characterId, hp });
}

function artikulListEntry(definition: ArtifactDefinition): FightArtikulListWire {
  return {
    id: definition.id,
    title: definition.title,
    picture: definition.picture,
    type_id: definition.typeId,
    kind_id: definition.kindId,
    price: definition.priceMinor / 100,
    level_min: definition.levelMin,
    level_max: definition.levelMax,
    flags: definition.flags,
    slot_mask: definition.slotMask,
    cnt: 1,
  };
}
