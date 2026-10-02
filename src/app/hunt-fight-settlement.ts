import type { ArtifactSkillBonus } from "../modules/catalog/domain/artifact-skill-bonus.ts";
import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { Hero } from "../modules/character/domain/hero.ts";
import type { CharacterMoney } from "../modules/character/ports/character-money.ts";
import type { CharacterProgression } from "../modules/character/ports/character-progression.ts";
import type { CharacterResources } from "../modules/character/ports/character-resources.ts";
import {
  fightLootBlock,
  type FightArtikulListWire,
  type FightLootBlock,
} from "../modules/combat/domain/fight-loot-block.ts";
import { goldWireString } from "../modules/combat/domain/fight-money.ts";
import type {
  FightHumanOutcome,
  FightOutcomeSnapshot,
  PracticeFightOutcomeSnapshot,
  PvpFightOutcomeSnapshot,
} from "../modules/combat/domain/fight-outcome-snapshot.ts";
import type { RandomSource } from "../modules/combat/domain/random-source.ts";
import type {
  FightSettlement,
  HumanLeftSnapshot,
} from "../modules/combat/ports/fight-settlement.ts";
import type { FightLootRouting } from "../modules/combat/ports/fight-loot-routing.ts";
import type { FightPartyLootNotify } from "../modules/combat/ports/fight-party-loot-notify.ts";
import type { HeroLifetimeStats } from "../modules/character/ports/hero-lifetime-stats.ts";
import { DAILY_CYCLE_RULES, lastMoscow6am } from "../modules/quests/domain/daily-cycle-rules.ts";
import { fightCounterDeltas } from "./fight-counter-deltas.ts";
import type { HeroBestiary } from "../modules/character/ports/hero-bestiary.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { DeathDurabilityBreak } from "../modules/inventory/domain/apply-death-durability.ts";
import type { QuestLootNeeded } from "../modules/quests/ports/quest-loot-needed.ts";
import type { PartyBagDeposit } from "../modules/party/ports/party-bag-deposit.ts";
import { FINISHED_FIGHT_RETENTION_MS } from "../modules/combat/domain/finished-fight-retention.ts";
import type { Clock } from "../shared/kernel/clock.ts";
import { TtlMap } from "../shared/kernel/ttl-map.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import type { HeroismRules } from "./heroism-rules.ts";
import type { Drop, HuntOutcome } from "./hunt-reward-plan.ts";
import { planHuntPayout } from "./hunt-payout.ts";
import { persistPvpHonor } from "./persist-pvp-honor.ts";
import type { PvpFightHonorCache } from "./pvp-fight-honor-cache.ts";
import type { DungeonPersonalGrant } from "./dungeon-personal-grant.ts";
import { FightDeathBreaks } from "./fight-death-breaks.ts";
import { FightProgressLog, type FightProgressUp } from "./fight-progress-log.ts";
import { loadArtikulList, persistFightResources } from "./hunt-fight-loot-apply.ts";

type SettlementCharacters = CharacterResources &
  CharacterProgression &
  CharacterMoney &
  HeroLifetimeStats &
  Readonly<{
    lockById(characterId: number): Promise<Hero>;
    applyEquipmentVitals(hero: Hero, bonuses: readonly ArtifactSkillBonus[]): Promise<Hero>;
  }>;

export class HuntFightSettlement implements FightSettlement {
  private readonly finished: TtlMap<string, Map<number, FightLootBlock>>;
  private readonly left: TtlMap<string, true>;
  private readonly progress = new FightProgressLog();
  private readonly deathBreaks: FightDeathBreaks;

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
    private readonly clock: Clock,
  ) {
    this.finished = new TtlMap(FINISHED_FIGHT_RETENTION_MS, clock);
    this.left = new TtlMap(FINISHED_FIGHT_RETENTION_MS, clock);
    this.deathBreaks = new FightDeathBreaks(clock);
  }

  persistHumanLeft(snapshot: HumanLeftSnapshot): Promise<void> {
    const key = `${snapshot.fightId}:${snapshot.accountId}`;
    if (this.left.has(key)) return Promise.resolve();
    this.left.set(key, true);
    return this.unitOfWork.run(async () => {
      await persistFightResources(this.characters, snapshot);
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
    return this.persistHunt(outcome);
  }

  private async persistHunt(outcome: HuntOutcome): Promise<ReadonlyMap<number, FightLootBlock>> {
    const cached = this.finished.get(outcome.fightId);
    if (cached) return cached;
    const opener = outcome.humans[0];
    if (!opener) throw new Error("Hunt outcome is missing the opener");
    const rewarded = outcome.humans.filter((human) => human.team === opener.team);
    const dungeonCtx =
      outcome.kind === "win" ? await this.dungeonGrant.load(outcome.fightId) : null;
    const route = await this.lootRouting.routeFor(rewarded.map((human) => human.characterId));
    const payout = await planHuntPayout(
      {
        catalog: this.catalog,
        inventory: this.inventory,
        lootNeeded: this.lootNeeded,
        random: this.random,
      },
      {
        outcome,
        rewarded,
        route,
        excludedDrops: dungeonCtx === null ? null : dungeonCtx.exclude,
      },
    );
    const lootByAccount = new Map<number, FightLootBlock>();
    await this.unitOfWork.run(async () => {
      const personal =
        dungeonCtx === null ? [] : await this.dungeonGrant.prepare(dungeonCtx, outcome);
      const personalList = await loadArtikulList(
        this.catalog,
        personal[0] === undefined ? [] : personal[0].items,
      );
      if (route && payout.deferred.length > 0) {
        await this.partyBag.deposit(
          route.partyId,
          payout.deferred.map((drop) => ({ artikulId: drop.artikulId, quantity: drop.quantity })),
        );
      }
      for (const human of outcome.humans) {
        const ownTeam = human.team === opener.team;
        const mine = personal.find((row) => row.characterId === human.characterId);
        const drops = ownTeam ? (payout.drops.get(human.characterId) ?? []) : [];
        lootByAccount.set(
          human.accountId,
          await this.rewardHuman(outcome, human, {
            experience: ownTeam ? (payout.experience.get(human.characterId) ?? 0) : 0,
            goldMinor: ownTeam ? (payout.goldMinor.get(human.characterId) ?? 0) : 0,
            drops,
            extra: mine === undefined ? [] : mine.items,
            artikulList: [
              ...(await loadArtikulList(this.catalog, drops)),
              ...(mine === undefined || mine.items.length === 0 ? [] : personalList),
            ],
          }),
        );
      }
      for (const kill of payout.bestiaryKills) {
        await this.bestiary.noteWin(kill.heroId, kill.botId);
      }
      await this.recordCounters(outcome);
    });
    this.finished.set(outcome.fightId, lootByAccount);
    if (route && (payout.partyMoneyMinor > 0 || payout.deferred.length > 0)) {
      await this.partyLoot.notify({
        partyId: route.partyId,
        fightId: outcome.fightId,
        lootRules: route.lootRules,
        moneyMinor: payout.partyMoneyMinor,
        items: payout.deferred,
        artikulList: await loadArtikulList(this.catalog, payout.deferred),
      });
    }
    return lootByAccount;
  }

  /** What one human takes out of a hunt: his hp and pocket, experience, gold, drops; the loot block. */
  private async rewardHuman(
    outcome: HuntOutcome,
    human: FightHumanOutcome,
    reward: Readonly<{
      experience: number;
      goldMinor: number;
      drops: readonly Drop[];
      extra: readonly Drop[];
      artikulList: readonly FightArtikulListWire[];
    }>,
  ): Promise<FightLootBlock> {
    if (!human.leftLive) {
      await persistFightResources(this.characters, {
        characterId: human.characterId,
        hp: human.hp,
        mp: human.mp,
      });
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
    if (reward.experience >= 1) {
      const grant = await this.characters.grantExperience({
        characterId: human.characterId,
        operationId: `fight:${outcome.fightId}:${human.characterId}`,
        amount: reward.experience,
      });
      if (grant.levelsGained > 0) {
        this.progress.note(outcome.fightId, {
          kind: "level",
          accountId: human.accountId,
          before: grant.levelBefore,
          after: grant.levelAfter,
        });
      }
    }
    if (reward.goldMinor >= 1) {
      await this.characters.creditMoney({
        characterId: human.characterId,
        minorUnits: reward.goldMinor,
      });
    }
    for (const drop of [...reward.drops, ...reward.extra]) {
      await this.inventory.grantToBag({
        characterId: human.characterId,
        artifactId: drop.artikulId,
        quantity: drop.quantity,
      });
    }
    return fightLootBlock({
      fightId: outcome.fightId,
      experience: reward.experience,
      money: goldWireString(reward.goldMinor),
      items: [...reward.drops, ...reward.extra].map((drop) => ({
        artikul_id: drop.artikulId,
        amount: drop.quantity,
      })),
      artikulList: reward.artikulList,
    });
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
      await this.recordCounters(outcome);
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
    const honor = await this.unitOfWork.run(async () => {
      for (const human of outcome.humans) {
        if (human.leftLive) continue;
        await persistFightResources(this.characters, {
          characterId: human.characterId,
          hp: human.hp,
          mp: human.mp,
        });
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
      await this.recordCounters(outcome);
      return persistPvpHonor({
        outcome,
        characters: this.characters,
        catalog: this.catalog,
        rules: this.heroism,
      });
    });
    this.pvpHonor.remember(outcome.fightId, honor.shares);
    for (const up of honor.rankUps) this.progress.note(outcome.fightId, up);
    this.finished.set(outcome.fightId, lootByAccount);
    return lootByAccount;
  }

  /** The lifetime counters of everyone who stayed to the end of the fight. */
  private async recordCounters(outcome: FightOutcomeSnapshot): Promise<void> {
    const now = Math.floor(this.clock.now().getTime() / 1000);
    for (const delta of fightCounterDeltas(outcome, lastMoscow6am(now, DAILY_CYCLE_RULES))) {
      await this.characters.applyFight(delta);
    }
  }

  honorOf(fightId: string): ReadonlyMap<number, number> {
    return this.pvpHonor.honorByAccount(fightId);
  }

  async publishEnded(fightId: string): Promise<void> {
    if (!fightId) throw new Error("Fight id is required");
  }

  takeProgress(fightId: string): readonly FightProgressUp[] {
    return this.progress.take(fightId);
  }

  takeDeathBreaks(fightId: string): ReadonlyMap<number, readonly DeathDurabilityBreak[]> {
    return this.deathBreaks.takeFight(fightId);
  }

  takeAccountDeathBreaks(fightId: string, accountId: number): readonly DeathDurabilityBreak[] {
    return this.deathBreaks.takeAccount(fightId, accountId);
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
    this.deathBreaks.remember(fightId, accountId, result.breaks);
    if (!result.paperdollChanged) return;
    const hero = await this.characters.lockById(characterId);
    await this.characters.applyEquipmentVitals(
      hero,
      await this.inventory.equippedSkillBonuses(characterId),
    );
  }
}
