import type { BotDefinition } from "../../catalog/domain/bot-definition.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../character/application/character-service.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";
import type { WorldService } from "../../world/domain/world-service.ts";
import {
  buildLocationAreaConf,
  huntBotsForArea,
  type LocationAreaConfBlock,
} from "./area-conf-block.ts";
import type { CommonConfBlock } from "./common-conf-document.ts";
import { buildHuntBlock, type HuntBlock } from "./hunt-block.ts";
import {
  buildUserUnitframe,
  type UnitframeHudPolicy,
  type UserUnitframeBlock,
} from "./user-unitframe-block.ts";

export type { HuntBlock, UserUnitframeBlock };

type StatusOkBlock = Readonly<{ status: 100 }>;

export type HeroStateBlock = Readonly<{
  area_id: string;
  level: number;
  hp: number;
  hp_max: number;
  money: string;
  money_gold: string;
}>;

type BagItemBlock = Readonly<{
  id: number;
  artikul_id: number;
  title: string;
  picture: string;
  type_id: string;
  kind_id: number;
  slot_mask: number;
  cnt: number;
  action: "bag";
}>;

type UserBagBlock = Readonly<{
  status: 100;
  bag: Readonly<Record<string, BagItemBlock>>;
  amount: number;
  amount_max: number;
}>;

type UserPocketBlock = Readonly<{
  status: 100;
  capacity: number;
  pocket: readonly [];
}>;

type UserConfBlock = Readonly<{
  status: 100;
  id: number;
  nick: string;
  level: number;
  kind: number;
}>;

type UserPersonalDetailsBlock = Readonly<{
  status: 100;
  info: Readonly<Record<string, unknown>>;
}>;

type InitBlocks = Readonly<{
  "common|init": StatusOkBlock;
  state: HeroStateBlock;
  "user|bag": UserBagBlock;
  "user|pocket": UserPocketBlock;
  "user|conf": UserConfBlock;
  "user|personal_details": UserPersonalDetailsBlock;
}>;

type Init2Blocks = Readonly<{
  "common|init2": StatusOkBlock;
  state: HeroStateBlock;
  "user|unitframe": UserUnitframeBlock;
  "common|area_conf": LocationAreaConfBlock;
  "common|hunt": HuntBlock;
}>;

function moneyFromMinorUnits(value: number): string {
  if (!Number.isInteger(value) || value < 0) throw new Error("Invalid money amount");
  return (value / 100).toFixed(2);
}

export class BootstrapReadModel {
  constructor(
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly catalog: Catalog,
    private readonly world: WorldService,
    private readonly policy: Readonly<{
      diamonds: string;
      bagCapacity: number;
      pocketCapacity: number;
      heroKind: number;
      tutorialInfo: Readonly<{
        finished_first_fight: string;
        tutorial2: string;
      }>;
      commonConf: CommonConfBlock;
      unitframe: UnitframeHudPolicy;
    }>,
  ) {}

  get heroKind(): number {
    return this.policy.heroKind;
  }

  get commonConf(): CommonConfBlock {
    return this.policy.commonConf;
  }

  async unitframe(accountId: number): Promise<UserUnitframeBlock> {
    return buildUserUnitframe(await this.requireHero(accountId), this.policy.unitframe);
  }

  async init(accountId: number): Promise<InitBlocks> {
    const hero = await this.requireHero(accountId);
    const storedInfo = await this.characters.personalDetails(accountId);
    const items = await this.inventory.list(hero.id);
    const bag: Record<string, BagItemBlock> = {};
    for (const item of items) {
      if (item.location.kind !== "bag") continue;
      const definition = await this.catalog.artifact(item.artifactId);
      if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
      bag[String(item.id)] = {
        id: item.id,
        artikul_id: definition.id,
        title: definition.title,
        picture: definition.picture,
        type_id: definition.typeId,
        kind_id: definition.kindId,
        slot_mask: definition.slotMask,
        cnt: item.quantity,
        action: "bag",
      };
    }

    return {
      "common|init": { status: 100 },
      state: {
        area_id: hero.areaId,
        level: hero.level,
        hp: hero.hp,
        hp_max: hero.maxHp,
        money: moneyFromMinorUnits(hero.moneyMinor),
        money_gold: this.policy.diamonds,
      },
      "user|bag": {
        status: 100,
        bag,
        amount: Object.keys(bag).length,
        amount_max: this.policy.bagCapacity,
      },
      "user|pocket": { status: 100, capacity: this.policy.pocketCapacity, pocket: [] },
      "user|conf": {
        status: 100,
        id: hero.id,
        nick: hero.nick,
        level: hero.level,
        kind: this.policy.heroKind,
      },
      "user|personal_details": {
        status: 100,
        info: { ...storedInfo, ...this.policy.tutorialInfo },
      },
    };
  }

  async init2(accountId: number): Promise<Init2Blocks> {
    const hero = await this.requireHero(accountId);
    const area = await this.world.area(hero.areaId);
    const bots = new Map<number, BotDefinition>();
    for (const spawn of area.spawns) {
      const definition = await this.catalog.bot(spawn.botId);
      if (!definition) throw new Error(`Bot catalog entry ${spawn.botId} is missing`);
      bots.set(definition.id, definition);
    }

    return {
      "common|init2": { status: 100 },
      state: {
        area_id: hero.areaId,
        level: hero.level,
        hp: hero.hp,
        hp_max: hero.maxHp,
        money: moneyFromMinorUnits(hero.moneyMinor),
        money_gold: this.policy.diamonds,
      },
      "user|unitframe": buildUserUnitframe(hero, this.policy.unitframe),
      "common|area_conf": buildLocationAreaConf(area, huntBotsForArea(area.spawns, bots)),
      "common|hunt": buildHuntBlock(area.spawns),
    };
  }

  private async requireHero(accountId: number) {
    const hero = await this.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    return hero;
  }
}
