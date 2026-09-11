import type { FarmCatalog } from "../../catalog/ports/farm-catalog.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../character/application/character-service.ts";
import { GhostHeroError } from "../../character/domain/ghost-hero-error.ts";
import { InsufficientMoneyError } from "../../character/domain/insufficient-money-error.ts";
import { goldToMinor } from "../../character/shared/gold-to-minor.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";
import type { WorldService } from "../../world/domain/world-service.ts";
import type { Clock } from "../../../shared/kernel/clock.ts";
import type { UnitOfWork } from "../../../shared/kernel/unit-of-work.ts";
import { requirePresent } from "../../../shared/kernel/require-present.ts";
import type { AssistantTypeDefinition } from "../../catalog/domain/assistant-type-definition.ts";
import type { HeroAssistant } from "../domain/hero-assistant.ts";
import {
  assignmentForWork,
  assertCanWork,
  clearedAssignment,
  decrementFarmStock,
  finishCycle,
  freeAssistantInsert,
  isBusy,
  isWaiting,
} from "../domain/farm-jobs.ts";
import { slotGoldCost, type FarmOutcome, type FarmRng } from "../domain/farm-formulas.ts";
import { ProfessionDeniedError } from "../domain/profession-denied-error.ts";
import type { FarmStockRepository } from "../ports/farm-stock-repository.ts";
import type { HeroAssistantRepository } from "../ports/hero-assistant-repository.ts";
import type { HeroFarmStatRepository } from "../ports/hero-farm-stat-repository.ts";
import { consumeAssistantUpgrade } from "./consume-assistant-upgrade.ts";
import { serializeAssistantInfo, serializeFarmInfo } from "./assistant-read-model.ts";

export type FarmFinishNotice = Readonly<{
  accountId: number;
  heroId: number;
  finished: ReadonlyArray<{ assistant_id: number; result: FarmOutcome }>;
  bagDirty: boolean;
}>;

export type AssistantWorkResult = Readonly<{ ftime: number; stime: number }>;

export class ProfessionsService {
  constructor(
    private readonly assistants: HeroAssistantRepository,
    private readonly stocks: FarmStockRepository,
    private readonly heroFarmStats: HeroFarmStatRepository,
    private readonly catalog: Catalog & FarmCatalog,
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly world: WorldService,
    private readonly clock: Clock,
    private readonly unitOfWork: UnitOfWork,
    private readonly rng: FarmRng,
  ) {
    requirePresent(this.rng, "Professions module requires a random source");
  }

  async info(heroId: number): Promise<object> {
    return this.unitOfWork.run(async () =>
      serializeAssistantInfo(
        this.assistants,
        this.catalog,
        this.world,
        heroId,
        this.clock.unixSeconds(),
        await this.characters.professionLicenses(heroId),
      ),
    );
  }

  async farmInfo(areaId: string): Promise<object> {
    return this.unitOfWork.run(() =>
      serializeFarmInfo(this.stocks, this.catalog, areaId, this.clock.unixSeconds()),
    );
  }

  async farmStats(heroId: number): Promise<object[]> {
    return this.unitOfWork.run(async () => {
      const rows = await this.heroFarmStats.listByHero(heroId);
      const out: object[] = [];
      for (const row of rows) {
        const farm = await this.catalog.farmResource(row.farmId);
        if (!farm) throw new Error(`Farm resource ${row.farmId} is missing`);
        out.push({
          type_id: String(farm.profession),
          title: farm.title,
          value: row.value,
          object_id: String(row.farmId),
        });
      }
      return out;
    });
  }

  async work(heroId: number, assistantId: number, farmId: number): Promise<AssistantWorkResult> {
    return this.unitOfWork.run(async () => {
      const hero = await this.requireLivingHero(heroId, "assistantWork");
      const row = await this.requireAssistant(heroId, assistantId);
      const now = this.clock.unixSeconds();
      if (row.cycleResult) throw new ProfessionDeniedError("Сначала заберите результат");
      if (isBusy(row, now)) throw new ProfessionDeniedError("Гремлин занят");
      if (isWaiting(row, now)) throw new ProfessionDeniedError("Ещё не готово");
      const started = await this.startWork(row, farmId, hero.areaId, now);
      return { ftime: started.ftime, stime: started.stime };
    });
  }

  async repeat(heroId: number, assistantId: number): Promise<AssistantWorkResult> {
    return this.unitOfWork.run(async () => {
      const hero = await this.requireLivingHero(heroId, "assistantRepeat");
      const row = await this.requireAssistant(heroId, assistantId);
      const now = this.clock.unixSeconds();
      if (!row.cycleResult) throw new ProfessionDeniedError("Ещё не готово");
      if (row.farmId <= 0) throw new ProfessionDeniedError("Гремлин свободен");
      await this.grantPendingLoot(row);
      const areaId = row.areaId === "0" ? hero.areaId : row.areaId;
      const started = await this.startWork(row, row.farmId, areaId, now);
      return { ftime: started.ftime, stime: started.stime };
    });
  }

  async revoke(heroId: number, assistantId: number): Promise<void> {
    await this.unitOfWork.run(async () => {
      await this.requireLivingHero(heroId, "assistantRevoke");
      const row = await this.requireAssistant(heroId, assistantId);
      await this.grantPendingLoot(row);
      await this.assistants.save(clearedAssignment(row));
    });
  }

  async save(
    heroId: number,
    assistantId: number,
    patch: Readonly<{
      nick?: string;
      tactics?: number;
      speed?: number;
      defence?: number;
      intellect?: number;
    }>,
  ): Promise<void> {
    await this.unitOfWork.run(async () => {
      await this.requireLivingHero(heroId, "assistantSave");
      const row = await this.requireAssistant(heroId, assistantId);
      const type = await this.requireType(row.artikulId);
      const speed = Math.max(0, Math.floor(patch.speed ?? row.skillSpeed));
      const defence = Math.max(0, Math.floor(patch.defence ?? row.skillDefence));
      const intellect = Math.max(0, Math.floor(patch.intellect ?? row.skillIntellect));
      if (speed + defence + intellect > type.skillSum) {
        throw new ProfessionDeniedError("Слишком много очков");
      }
      const tactics =
        patch.tactics == null ? row.tactics : Math.max(0, Math.floor(patch.tactics) % 3);
      await this.assistants.save({
        ...row,
        nick: patch.nick ?? row.nick,
        skillSpeed: speed,
        skillDefence: defence,
        skillIntellect: intellect,
        tactics,
      });
    });
  }

  async create(heroId: number, artikulId: number): Promise<void> {
    await this.unitOfWork.run(async () => {
      await this.requireLivingHero(heroId, "assistantCreate");
      const type = await this.catalog.assistantType(artikulId);
      if (!type || type.profession < 1 || type.profession > 3) {
        throw new ProfessionDeniedError("Нельзя купить этого гремлина");
      }
      const rows = await this.assistants.listByHero(heroId);
      const gather = await this.gatherCount(rows);
      const cost = slotGoldCost(gather);
      if (cost == null) throw new ProfessionDeniedError("Нет свободных слотов");
      const info = await serializeAssistantInfo(
        this.assistants,
        this.catalog,
        this.world,
        heroId,
        this.clock.unixSeconds(),
        await this.characters.professionLicenses(heroId),
      );
      const offers = (info as { new_assistants: Record<string, unknown> }).new_assistants;
      if (!offers[String(artikulId)]) {
        throw new ProfessionDeniedError("Этот гремлин сейчас не продаётся");
      }
      try {
        await this.characters.debitMoney({
          characterId: heroId,
          minorUnits: goldToMinor(cost),
          allowGhost: false,
        });
      } catch (error) {
        if (error instanceof InsufficientMoneyError) {
          throw new ProfessionDeniedError("Недостаточно денег");
        }
        throw error;
      }
      await this.assistants.insert(freeAssistantInsert(heroId, artikulId, type.title));
    });
  }

  async upgrade(heroId: number, assistantId: number): Promise<void> {
    await this.unitOfWork.run(async () => {
      const hero = await this.requireLivingHero(heroId, "assistantUpgrade");
      const row = await this.requireAssistant(heroId, assistantId);
      const current = await this.requireType(row.artikulId);
      if (current.profession === 0) throw new ProfessionDeniedError("Духи не могут улучшаться!");
      if (!current.nextArtikulId) throw new ProfessionDeniedError("Гремлин уже улучшен!");
      const next = await this.catalog.assistantType(current.nextArtikulId);
      if (!next) throw new ProfessionDeniedError("Гремлин уже улучшен!");
      await consumeAssistantUpgrade(this.inventory, this.characters, heroId, hero.level, next);
      await this.assistants.insert({
        ...freeAssistantInsert(heroId, next.id, row.nick),
        skillSpeed: row.skillSpeed,
        skillDefence: row.skillDefence,
        skillIntellect: row.skillIntellect,
        tactics: row.tactics,
        farmId: row.farmId,
        areaId: row.areaId,
        ftime: row.ftime,
        stime: row.stime,
        stamina: row.stamina,
        staminaResetTime: row.staminaResetTime,
        masteryValue: row.masteryValue,
        resultType: row.resultType,
        resultValue: row.resultValue,
        flags: row.flags,
        cycleResult: row.cycleResult,
        lootGranted: row.lootGranted,
      });
      await this.assistants.delete(row.id);
    });
  }

  async finishDue(): Promise<readonly FarmFinishNotice[]> {
    return this.unitOfWork.run(async () => {
      const now = this.clock.unixSeconds();
      const due = await this.assistants.listDue(now);
      const byHero = new Map<number, HeroAssistant[]>();
      for (const row of due) {
        const list = byHero.get(row.heroId) ?? [];
        list.push(row);
        byHero.set(row.heroId, list);
      }
      const notices: FarmFinishNotice[] = [];
      for (const [heroId, rows] of byHero) {
        const hero = await this.characters.getById(heroId);
        if (!hero) throw new Error(`Hero ${heroId} is missing`);
        const finished: Array<{ assistant_id: number; result: FarmOutcome }> = [];
        let bagDirty = false;
        for (const row of rows) {
          const done = await this.resolveOne(row, now);
          if (!done) continue;
          finished.push({ assistant_id: row.id, result: done.outcome });
          if (done.bagDirty) bagDirty = true;
        }
        if (finished.length === 0 && !bagDirty) continue;
        notices.push({ accountId: hero.accountId, heroId, finished, bagDirty });
      }
      return notices;
    });
  }

  private async resolveOne(
    row: HeroAssistant,
    now: number,
  ): Promise<{ outcome: FarmOutcome; bagDirty: boolean } | null> {
    if (row.cycleResult) return null;
    if (isBusy(row, now) && row.attackAt > 0 && row.attackAt <= now) {
      const farm = await this.requireFarm(row.farmId);
      const attacked = finishCycle(row, farm, 0, now, this.rng);
      await this.assistants.save(attacked.row);
      return { outcome: "attacked", bagDirty: false };
    }
    if (!isWaiting(row, now)) return null;
    const farm = await this.catalog.farmResource(row.farmId);
    if (!farm) {
      await this.assistants.save(clearedAssignment(row));
      return { outcome: "failure", bagDirty: false };
    }
    const spots = await this.catalog.areaFarms(row.areaId);
    const climate = spots[0]?.tactics;
    if (climate === undefined) throw new Error(`Area ${row.areaId} farm tactics are missing`);
    const finished = finishCycle(row, farm, climate, now, this.rng);
    let next = finished.row;
    let bagDirty = false;
    if (finished.outcome === "success") {
      bagDirty = await this.deliverLoot(next, farm.artifactArtikulId, now);
      next = { ...next, lootGranted: true };
    }
    await this.assistants.save(next);
    return { outcome: finished.outcome, bagDirty };
  }

  private async startWork(
    row: HeroAssistant,
    farmId: number,
    areaId: string,
    now: number,
  ): Promise<HeroAssistant> {
    const farm = await this.catalog.farmResource(farmId);
    if (!farm) throw new ProfessionDeniedError("Нет такой ноды");
    const type = await this.requireType(row.artikulId);
    const licenses = await this.characters.professionLicenses(row.heroId);
    const licensed = licenses.some(
      (item) => item.professionId === farm.profession && item.value >= 1,
    );
    const spots = await this.catalog.areaFarms(areaId);
    assertCanWork(
      type.profession,
      farm,
      licensed,
      spots.some((spot) => spot.farmId === farmId),
      row.masteryValue,
    );
    const next = assignmentForWork(row, farm, areaId, now, this.rng);
    await this.assistants.save(next);
    return next;
  }

  private async grantPendingLoot(row: HeroAssistant): Promise<boolean> {
    if (row.cycleResult !== "success" || row.lootGranted) return false;
    const artikul = Number(row.resultValue);
    if (!Number.isInteger(artikul) || artikul < 1) {
      throw new Error(`Assistant ${row.id} success loot artikul is missing`);
    }
    const ok = await this.deliverLoot(row, artikul, this.clock.unixSeconds());
    await this.assistants.save({ ...row, lootGranted: true });
    return ok;
  }

  private async deliverLoot(row: HeroAssistant, artikul: number, now: number): Promise<boolean> {
    if (row.areaId && row.areaId !== "0") {
      const took = await decrementFarmStock(this.stocks, this.catalog, row.areaId, row.farmId, now);
      if (!took) return false;
    }
    await this.inventory.grantToBag({ characterId: row.heroId, artifactId: artikul, quantity: 1 });
    await this.heroFarmStats.bump(row.heroId, row.farmId);
    return true;
  }

  private async gatherCount(rows: readonly HeroAssistant[]): Promise<number> {
    let count = 0;
    for (const row of rows) {
      const type = await this.requireType(row.artikulId);
      if (type.profession >= 1 && type.profession <= 3) count += 1;
    }
    return count;
  }

  private async requireAssistant(heroId: number, id: number): Promise<HeroAssistant> {
    const row = await this.assistants.findById(heroId, id);
    if (!row) throw new ProfessionDeniedError("Нет такого гремлина");
    return row;
  }

  private async requireType(id: number): Promise<AssistantTypeDefinition> {
    const type = await this.catalog.assistantType(id);
    if (!type) throw new ProfessionDeniedError("Неизвестный тип");
    return type;
  }

  private async requireFarm(id: number) {
    const farm = await this.catalog.farmResource(id);
    if (!farm) throw new Error(`Farm resource ${id} is missing`);
    return farm;
  }

  private async requireLivingHero(heroId: number, action: string) {
    const hero = await this.characters.lockById(heroId);
    if (hero.ghost) throw new GhostHeroError(heroId, action);
    return hero;
  }
}
