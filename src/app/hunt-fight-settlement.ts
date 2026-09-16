import type { ArtifactSkillBonus } from "../modules/catalog/domain/artifact-skill-bonus.ts";
import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { Hero } from "../modules/character/domain/hero.ts";
import type { CharacterMoney } from "../modules/character/ports/character-money.ts";
import type { CharacterProgression } from "../modules/character/ports/character-progression.ts";
import type { CharacterResources } from "../modules/character/ports/character-resources.ts";
import { fightLootBlock, type FightLootBlock } from "../modules/combat/domain/fight-loot-block.ts";
import {
  goldToMinor,
  goldWireString,
  rollMoneyGold,
} from "../modules/combat/domain/fight-money.ts";
import type {
  FightOutcomeSnapshot,
  PracticeFightOutcomeSnapshot,
  PvpFightOutcomeSnapshot,
} from "../modules/combat/domain/fight-outcome-snapshot.ts";
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
import type { FightLootRouting } from "../modules/combat/ports/fight-loot-routing.ts";
import type { FightPartyLootNotify } from "../modules/combat/ports/fight-party-loot-notify.ts";
import { bestiaryCreditHeroIds } from "../modules/character/domain/bestiary-kill-credit.ts";
import type { HeroBestiary } from "../modules/character/ports/hero-bestiary.ts";
import { splitMinorUnits } from "../modules/combat/domain/split-minor-units.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { DeathDurabilityBreak } from "../modules/inventory/domain/apply-death-durability.ts";
import type { QuestLootNeeded } from "../modules/quests/ports/quest-loot-needed.ts";
import type { PartyBagDeposit } from "../modules/party/ports/party-bag-deposit.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import type { HeroismRules } from "./heroism-rules.ts";
import { persistPvpHonor } from "./persist-pvp-honor.ts";
import type { PvpFightHonorCache } from "./pvp-fight-honor-cache.ts";
import type { DungeonPersonalGrant } from "./dungeon-personal-grant.ts";
import { capRolledDrops, loadArtikulList, persistFightHp } from "./hunt-fight-loot-apply.ts";

type SettlementCharacters = CharacterResources &
  CharacterProgression &
  CharacterMoney &
  Readonly<{
    lockById(characterId: number): Promise<Hero>;
    applyEquipmentVitals(hero: Hero, bonuses: readonly ArtifactSkillBonus[]): Promise<Hero>;
  }>;

export class HuntFightSettlement implements FightSettlement {
  private readonly finished = new Map<string, Map<number, FightLootBlock>>();
  private readonly left = new Set<string>();
  private readonly deathBreaks = new Map<string, Map<number, readonly DeathDurabilityBreak[]>>();

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly catalog: Catalog,
    private readonly characters: SettlementCharacters,
    private readonly inventory: InventoryService,
    private readonly random: RandomSource,
    private readonly lootRouting: FightLootRouting,
    private readonly partyBag: PartyBagDeposit,
    private readonly partyLoot: FightPartyLootNotify,
    private readonly bestiary: HeroBestiary,
    private readonly lootNeeded: QuestLootNeeded,
    private readonly heroism: HeroismRules,
    private readonly pvpHonor: PvpFightHonorCache,
    private readonly dungeonGrant: DungeonPersonalGrant,
  ) {}

  persistHumanLeft(snapshot: HumanLeftSnapshot): Promise<void> {
    const key = `${snapshot.fightId}:${snapshot.accountId}`;
    if (this.left.has(key)) return Promise.resolve();
    this.left.add(key);
    return this.unitOfWork.run(async () => {
      await persistFightHp(this.characters, snapshot.characterId, snapshot.hp);
      await this.applyDeathIfDefeated(
        snapshot.fightId,
        snapshot.accountId,
        snapshot.characterId,
        snapshot.hp,
      );
      await this.inventory.refillPocketAfterFight({
        characterId: snapshot.characterId,
        cells: snapshot.pocket,
      });
    });
  }

  async persistFinished(
    outcome: FightOutcomeSnapshot,
  ): Promise<ReadonlyMap<number, FightLootBlock>> {
    if (outcome.mode === "friendly-practice") return this.persistPractice(outcome);
    if (outcome.mode === "pvp") return this.persistPvp(outcome);
    const cached = this.finished.get(outcome.fightId);
    if (cached) return cached;
    const bot = await this.catalog.bot(outcome.botId);
    if (!bot) throw new Error(`Bot catalog entry ${outcome.botId} is missing`);
    const opener = outcome.humans[0];
    if (!opener) throw new Error("Hunt outcome is missing the opener");
    const rewarded = outcome.humans.filter((human) => human.team === opener.team);
    const win = outcome.kind === "win";
    const shares = rewarded.map((human) => ({
      characterId: human.characterId,
      damage: human.damageToBot,
      level: human.level,
    }));
    const experience = win
      ? splitFightExperience(bot.reward.baseExp, outcome.botLevel, shares)
      : new Map<number, number>();
    const top = win ? rankDamageShares(shares)[0] : undefined;
    if (win && top === undefined) {
      throw new Error("Hunt win is missing a top damager");
    }
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
    const dungeonCtx = win ? await this.dungeonGrant.load(outcome.fightId) : null;
    if (dungeonCtx) {
      rolled = rolled.filter((drop) => !dungeonCtx.exclude.has(drop.artikulId));
    }
    const route = await this.lootRouting.routeFor(rewarded.map((human) => human.characterId));
    const topInParty = Boolean(top && route?.memberCharacterIds.has(top.characterId));
    const partyMoney = topInParty ? moneyMinor : 0;
    const deferItems = Boolean(
      route && (route.lootRules === "2" || route.lootRules === "3") && topInParty && rolled.length,
    );
    if (win && top && rolled.length > 0 && !deferItems) {
      rolled = await capRolledDrops({
        inventory: this.inventory,
        lootNeeded: this.lootNeeded,
        characterId: top.characterId,
        rolled,
      });
    }
    const partyFighters = route
      ? outcome.humans.filter((human) => route.memberCharacterIds.has(human.characterId))
      : [];
    const splitMoney =
      route?.lootRules === "1" && partyFighters.length > 1 && topInParty && moneyMinor > 0;
    const moneyShares = splitMoney ? splitMinorUnits(moneyMinor, partyFighters.length) : null;
    const artikulList = await loadArtikulList(this.catalog, rolled);
    const lootByAccount = new Map<number, FightLootBlock>();
    await this.unitOfWork.run(async () => {
      const personal =
        dungeonCtx === null ? [] : await this.dungeonGrant.prepare(dungeonCtx, outcome);
      const personalList = await loadArtikulList(
        this.catalog,
        personal[0] === undefined ? [] : personal[0].items,
      );
      if (deferItems && route) {
        await this.partyBag.deposit(
          route.partyId,
          rolled.map((drop) => ({ artikulId: drop.artikulId, quantity: drop.quantity })),
        );
      }
      for (const human of outcome.humans) {
        const exp = human.team === opener.team ? (experience.get(human.characterId) ?? 0) : 0;
        const isTop = human.team === opener.team && top?.characterId === human.characterId;
        const splitIndex = partyFighters.findIndex((row) => row.characterId === human.characterId);
        const goldMinor = moneyShares
          ? splitIndex >= 0
            ? (moneyShares[splitIndex] ?? 0)
            : 0
          : isTop
            ? moneyMinor
            : 0;
        const drops = isTop && !deferItems ? rolled : [];
        const mine = personal.find((row) => row.characterId === human.characterId);
        const extra = mine === undefined ? [] : mine.items;
        if (!human.leftLive) {
          await persistFightHp(this.characters, human.characterId, human.hp);
          await this.applyDeathIfDefeated(
            outcome.fightId,
            human.accountId,
            human.characterId,
            human.hp,
          );
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
        for (const drop of extra) {
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
            items: [
              ...drops.map((drop) => ({ artikul_id: drop.artikulId, amount: drop.quantity })),
              ...extra.map((drop) => ({ artikul_id: drop.artikulId, amount: drop.quantity })),
            ],
            artikulList: [
              ...(isTop && !deferItems ? artikulList : []),
              ...(extra.length === 0 ? [] : personalList),
            ],
          }),
        );
      }
      for (const heroId of bestiaryCreditHeroIds({
        kind: outcome.kind,
        topCharacterId: top === undefined ? null : top.characterId,
        humanIds: rewarded.map((human) => human.characterId),
        partyMemberIds: route?.memberCharacterIds ?? null,
      })) {
        await this.bestiary.noteWin(heroId, outcome.botId);
      }
    });
    this.finished.set(outcome.fightId, lootByAccount);
    if (route && (partyMoney > 0 || deferItems)) {
      await this.partyLoot.notify({
        partyId: route.partyId,
        fightId: outcome.fightId,
        lootRules: route.lootRules,
        moneyMinor: partyMoney,
        items: deferItems ? rolled : [],
        artikulList: deferItems ? artikulList : [],
      });
    }
    return lootByAccount;
  }

  private async persistPractice(
    outcome: PracticeFightOutcomeSnapshot,
  ): Promise<ReadonlyMap<number, FightLootBlock>> {
    const cached = this.finished.get(outcome.fightId);
    if (cached) return cached;
    const lootByAccount = new Map<number, FightLootBlock>();
    await this.unitOfWork.run(async () => {
      for (const human of outcome.humans) {
        const restore = outcome.restore.find((entry) => entry.characterId === human.characterId);
        if (!restore) {
          throw new Error(`Friendly duel restore for hero ${human.characterId} is missing`);
        }
        await this.characters.noteHp({ characterId: human.characterId, hp: restore.hp });
        await this.characters.noteMp({ characterId: human.characterId, mp: restore.mp });
        await this.inventory.refillPocketAfterFight({
          characterId: human.characterId,
          cells: restore.pocket,
        });
      }
    });
    this.finished.set(outcome.fightId, lootByAccount);
    return lootByAccount;
  }

  private async persistPvp(
    outcome: PvpFightOutcomeSnapshot,
  ): Promise<ReadonlyMap<number, FightLootBlock>> {
    const cached = this.finished.get(outcome.fightId);
    if (cached) return cached;
    const lootByAccount = new Map<number, FightLootBlock>();
    const shares = await this.unitOfWork.run(async () => {
      for (const human of outcome.humans) {
        if (human.leftLive) continue;
        await persistFightHp(this.characters, human.characterId, human.hp);
        await this.inventory.refillPocketAfterFight({
          characterId: human.characterId,
          cells: human.pocket,
        });
        await this.applyDeathIfDefeated(
          outcome.fightId,
          human.accountId,
          human.characterId,
          human.hp,
        );
      }
      return persistPvpHonor({
        outcome,
        characters: this.characters,
        catalog: this.catalog,
        rules: this.heroism,
      });
    });
    this.pvpHonor.remember(outcome.fightId, shares);
    this.finished.set(outcome.fightId, lootByAccount);
    return lootByAccount;
  }

  async publishEnded(fightId: string): Promise<void> {
    if (!fightId) throw new Error("Fight id is required");
  }

  takeDeathBreaks(fightId: string): ReadonlyMap<number, readonly DeathDurabilityBreak[]> {
    const row = this.deathBreaks.get(fightId) ?? new Map();
    this.deathBreaks.delete(fightId);
    return row;
  }

  takeAccountDeathBreaks(fightId: string, accountId: number): readonly DeathDurabilityBreak[] {
    const row = this.deathBreaks.get(fightId);
    if (!row) return [];
    const breaks = row.get(accountId) ?? [];
    row.delete(accountId);
    if (row.size === 0) this.deathBreaks.delete(fightId);
    return breaks;
  }

  private async applyDeathIfDefeated(
    fightId: string,
    accountId: number,
    characterId: number,
    hp: number,
  ): Promise<void> {
    if (hp !== 0) return;
    const result = await this.inventory.applyDeathDurability({
      characterId,
      random: this.random,
    });
    this.rememberDeathBreaks(fightId, accountId, result.breaks);
    if (!result.paperdollChanged) return;
    const hero = await this.characters.lockById(characterId);
    await this.characters.applyEquipmentVitals(
      hero,
      await this.inventory.equippedSkillBonuses(characterId),
    );
  }

  private rememberDeathBreaks(
    fightId: string,
    accountId: number,
    breaks: readonly DeathDurabilityBreak[],
  ): void {
    if (breaks.length === 0) return;
    const row = this.deathBreaks.get(fightId) ?? new Map();
    if (row.has(accountId)) {
      throw new Error(`Death breaks for fight ${fightId} account ${accountId} already recorded`);
    }
    row.set(accountId, breaks);
    this.deathBreaks.set(fightId, row);
  }
}
