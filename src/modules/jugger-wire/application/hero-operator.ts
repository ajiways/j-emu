import type { CharacterService } from "../../character/application/character-service.ts";
import type { Hero } from "../../character/domain/hero.ts";
import { InsufficientMoneyError } from "../../character/domain/insufficient-money-error.ts";
import type { InventoryItem } from "../../inventory/domain/inventory-item.ts";
import { BagFullError } from "../../inventory/domain/bag-full-error.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";
import { MissingArtifactError } from "../../inventory/domain/missing-artifact-error.ts";
import type { UnitOfWork } from "../../../shared/kernel/unit-of-work.ts";
import { HeroOperatorError } from "./hero-operator-error.ts";

type HeroOperatorItem = Readonly<{
  id: number;
  artifactId: number;
  quantity: number;
  durability: number;
  durabilityMax: number;
}>;

type HeroOperatorState = Readonly<{
  id: number;
  nick: string;
  level: number;
  exp: number;
  moneyMinor: number;
  moneyGoldMinor: number;
  bag: readonly HeroOperatorItem[];
  pocket: readonly (HeroOperatorItem & { position: number })[];
  paperdoll: readonly (HeroOperatorItem & { slot: number })[];
}>;

type OperatorCharacters = Pick<CharacterService, "getById" | "creditMoney" | "debitMoney">;
type OperatorInventory = Pick<InventoryService, "list" | "grantToBag">;

export class HeroOperator {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly characters: OperatorCharacters,
    private readonly inventory: OperatorInventory,
  ) {}

  async state(heroId: number): Promise<HeroOperatorState> {
    const hero = await this.requireHero(heroId);
    return this.snapshot(hero);
  }

  grantItem(heroId: number, artifactId: number, quantity: number): Promise<HeroOperatorState> {
    return this.unitOfWork.run(async () => {
      await this.requireHero(heroId);
      try {
        await this.inventory.grantToBag({ characterId: heroId, artifactId, quantity });
      } catch (error) {
        throw mapGrantError(error);
      }
      return this.snapshot(await this.requireHero(heroId));
    });
  }

  adjustMoney(heroId: number, minorUnits: number): Promise<HeroOperatorState> {
    return this.unitOfWork.run(async () => {
      const hero = await this.requireHero(heroId);
      try {
        if (minorUnits > 0) {
          await this.characters.creditMoney({ characterId: hero.id, minorUnits });
        } else {
          await this.characters.debitMoney({
            characterId: hero.id,
            minorUnits: -minorUnits,
            allowGhost: true,
          });
        }
      } catch (error) {
        throw mapMoneyError(error);
      }
      return this.snapshot(await this.requireHero(heroId));
    });
  }

  private async requireHero(heroId: number): Promise<Hero> {
    const hero = await this.characters.getById(heroId);
    if (!hero) throw new HeroOperatorError(404, `Hero ${heroId} was not found`);
    return hero;
  }

  private async snapshot(hero: Hero): Promise<HeroOperatorState> {
    const items = await this.inventory.list(hero.id);
    return {
      id: hero.id,
      nick: hero.nick,
      level: hero.level,
      exp: hero.exp,
      moneyMinor: hero.moneyMinor,
      moneyGoldMinor: hero.moneyGoldMinor,
      bag: items
        .filter((item) => item.location.kind === "bag")
        .map(baseItem)
        .sort(byId),
      pocket: items
        .filter((item) => item.location.kind === "pocket")
        .map((item) => {
          if (item.location.kind !== "pocket") {
            throw new Error(`Item ${item.id} is not in pocket after pocket filter`);
          }
          return { ...baseItem(item), position: item.location.position };
        })
        .sort((left, right) => left.position - right.position),
      paperdoll: items
        .filter((item) => item.location.kind === "equipment")
        .map((item) => {
          if (item.location.kind !== "equipment") {
            throw new Error(`Item ${item.id} is not equipped after paperdoll filter`);
          }
          return { ...baseItem(item), slot: item.location.slot };
        })
        .sort((left, right) => left.slot - right.slot),
    };
  }
}

function baseItem(item: InventoryItem): HeroOperatorItem {
  return {
    id: item.id,
    artifactId: item.artifactId,
    quantity: item.quantity,
    durability: item.durability,
    durabilityMax: item.durabilityMax,
  };
}

function byId(left: HeroOperatorItem, right: HeroOperatorItem): number {
  return left.id - right.id;
}

function mapGrantError(error: unknown): HeroOperatorError {
  if (error instanceof HeroOperatorError) return error;
  if (error instanceof BagFullError) return new HeroOperatorError(409, error.message);
  if (error instanceof MissingArtifactError) return new HeroOperatorError(404, error.message);
  if (error instanceof Error) throw error;
  throw new Error("Hero item grant failed");
}

function mapMoneyError(error: unknown): HeroOperatorError {
  if (error instanceof HeroOperatorError) return error;
  if (error instanceof InsufficientMoneyError) return new HeroOperatorError(409, error.message);
  if (error instanceof Error && error.message === "Hero money overflow") {
    return new HeroOperatorError(409, error.message);
  }
  if (error instanceof Error) throw error;
  throw new Error("Hero money adjust failed");
}
