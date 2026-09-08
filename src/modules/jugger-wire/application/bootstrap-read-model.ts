import type { SkillDefinition } from "../../catalog/domain/skill-definition.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import { totalHeroSkills } from "../../character/domain/equipment-skill-totals.ts";
import type { CharacterService } from "../../character/application/character-service.ts";
import type { Clock } from "../../../shared/kernel/clock.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";
import type { WorldService } from "../../world/domain/world-service.ts";
import type { CombatPort } from "../../combat/ports/combat-port.ts";
import type { BotDefinition } from "../../catalog/domain/bot-definition.ts";
import type { CommonConfBlock } from "../../content/domain/bootstrap-content.ts";
import {
  buildLocationAreaConf,
  huntBotsForArea,
  type LocationAreaConfBlock,
} from "./area-conf-block.ts";
import { emptyBookTrio } from "./book-quest-blocks.ts";
import { overlayCaptureAreaId, overlayChromeAreaId } from "./chrome-area-overlay.ts";
import { artifactSkillWireMap } from "./artifact-skill-wire.ts";
import { buildEquippedArtifact } from "./equipped-artifact-block.ts";
import { equippedSkillBonuses } from "./equipped-skill-bonuses.ts";
import { buildHeroState, type HeroStateBlock } from "./hero-state-block.ts";
import { buildHuntBlock, type HuntBlock } from "./hunt-block.ts";
import { buildMenuLinkStatus } from "./menu-link-status-block.ts";
import { buildChatConf, type ChatConfPolicy } from "./chat-conf-block.ts";
import { buildUserBag, buildUserPocket } from "./user-bag-block.ts";
import { buildUserConf } from "./user-conf-block.ts";
import { emptyUserMagic } from "./user-magic-block.ts";
import { buildUserSkills, skillsExpireBlock, type UserSkillsBlock } from "./user-skills-block.ts";
import { buildUserUnitframe, type UserUnitframeBlock } from "./user-unitframe-block.ts";
import { buildUserView, type UserViewBlock } from "./user-view-block.ts";
import { buildWelcomeMessage } from "./welcome-message-block.ts";

export type { HuntBlock, UserUnitframeBlock, HeroStateBlock };

type StatusOkBlock = Readonly<{ status: 100 }>;

export class BootstrapReadModel {
  constructor(
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly catalog: Catalog,
    private readonly world: WorldService,
    private readonly combat: CombatPort,
    private readonly clock: Clock,
    private readonly policy: Readonly<{
      bagCapacity: number;
      pocketCapacity: number;
      chat: ChatConfPolicy;
      menuLinks: Readonly<Record<string, string>>;
    }>,
  ) {}

  async commonConf(): Promise<CommonConfBlock> {
    return this.catalog.commonConf();
  }

  async state(accountId: number): Promise<HeroStateBlock> {
    return buildHeroState(await this.requireHero(accountId), this.clock);
  }

  async hunt(accountId: number): Promise<HuntBlock> {
    const hero = await this.requireHero(accountId);
    const area = await this.world.area(hero.areaId);
    return buildHuntBlock(area.spawns);
  }

  async unitframe(accountId: number): Promise<UserUnitframeBlock> {
    const hero = await this.requireHero(accountId);
    const level = await this.catalog.level(hero.level);
    const appearance = await this.catalog.appearance(hero.kind, hero.gender);
    const hud = await this.catalog.hudDefaults();
    const inActiveFight = (await this.combat.activeFightId(accountId)) !== null;
    return buildUserUnitframe(hero, level, appearance, hud, inActiveFight);
  }

  async skills(accountId: number): Promise<UserSkillsBlock> {
    const hero = await this.requireHero(accountId);
    const naked = await this.characters.skillsFor(accountId);
    const totals = totalHeroSkills(
      naked,
      await equippedSkillBonuses(this.inventory, this.catalog, hero.id),
    );
    const definitions = new Map<string, SkillDefinition>();
    for (const skill of totals) {
      definitions.set(skill.id, await this.catalog.skill(skill.id));
    }
    return buildUserSkills(totals, definitions, this.policy.bagCapacity);
  }

  async view(accountId: number): Promise<UserViewBlock> {
    const hero = await this.requireHero(accountId);
    const level = await this.catalog.level(hero.level);
    const appearance = await this.catalog.appearance(hero.kind, hero.gender);
    const artifacts = [];
    for (const item of await this.inventory.list(hero.id)) {
      if (item.location.kind !== "equipment") continue;
      const definition = await this.catalog.artifact(item.artifactId);
      if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
      artifacts.push(
        buildEquippedArtifact(
          item,
          definition,
          await artifactSkillWireMap(definition.skills, this.catalog),
        ),
      );
    }
    return buildUserView(hero, appearance, level, artifacts);
  }

  async equipmentMutation(accountId: number): Promise<Readonly<Record<string, unknown>>> {
    const hero = await this.requireHero(accountId);
    const level = await this.catalog.level(hero.level);
    return {
      "common|action": statusOk(),
      "user|bag": await buildUserBag(hero, this.inventory, this.catalog),
      "user|view": await this.view(accountId),
      "user|pocket": buildUserPocket(this.policy.pocketCapacity),
      "user|skills": await this.skills(accountId),
      "user|unitframe": await this.unitframe(accountId),
      "user|conf": buildUserConf(hero, level),
      state: buildHeroState(hero, this.clock),
    };
  }

  async bagDropMutation(
    accountId: number,
    action: "DROP" | "SELL",
  ): Promise<Readonly<Record<string, unknown>>> {
    const hero = await this.requireHero(accountId);
    const chrome = await this.catalog.chrome();
    return {
      "common|action": { status: 100, action },
      "user|bag": await buildUserBag(hero, this.inventory, this.catalog),
      "user|skills": await this.skills(accountId),
      "user|mount_list": chrome.block("user|mount_list"),
      state: buildHeroState(hero, this.clock),
    };
  }

  async init(accountId: number): Promise<Readonly<Record<string, unknown>>> {
    const hero = await this.requireHero(accountId);
    const level = await this.catalog.level(hero.level);
    const chrome = await this.catalog.chrome();
    const book = emptyBookTrio("started");
    return {
      "common|init": statusOk(),
      "common|conf": await this.catalog.commonConf(),
      state: buildHeroState(hero, this.clock),
      "user|bag": await buildUserBag(hero, this.inventory, this.catalog),
      "user|pocket": buildUserPocket(this.policy.pocketCapacity),
      "user|magic": emptyUserMagic(),
      "user|conf": buildUserConf(hero, level),
      "user|personal_details": {
        status: 100,
        info: await this.characters.personalDetails(accountId),
      },
      "user|skills": await this.skills(accountId),
      "user|professions": chrome.block("user|professions"),
      "pet|list": chrome.block("pet|list"),
      "user|mount_list": chrome.block("user|mount_list"),
      ...book,
      "user|campaigns": chrome.block("user|campaigns"),
    };
  }

  async init2(accountId: number): Promise<Readonly<Record<string, unknown>>> {
    const hero = await this.requireHero(accountId);
    const area = await this.world.area(hero.areaId);
    const bots = new Map<number, BotDefinition>();
    for (const spawn of area.spawns) {
      const definition = await this.catalog.bot(spawn.botId);
      if (!definition) throw new Error(`Bot catalog entry ${spawn.botId} is missing`);
      bots.set(definition.id, definition);
    }
    const chrome = await this.catalog.chrome();
    const areaConf: LocationAreaConfBlock = buildLocationAreaConf(
      area,
      huntBotsForArea(area.spawns, bots),
    );
    return {
      "common|init2": statusOk(),
      state: buildHeroState(hero, this.clock),
      "user|unitframe": await this.unitframe(accountId),
      "chat|conf": buildChatConf(hero.accountId, this.policy.chat),
      "chat|area_population": chrome.block("chat|area_population"),
      "chat|message": buildWelcomeMessage(hero, chrome.welcomeTemplate, this.clock),
      "friend|info": chrome.block("friend|info"),
      "user|action_stats": chrome.block("user|action_stats"),
      "arena|great_fights": chrome.block("arena|great_fights"),
      "user|skills": skillsExpireBlock(),
      "user|time_to_next_achievement": chrome.block("user|time_to_next_achievement"),
      "assistant|farm_info": overlayChromeAreaId(
        chrome.block("assistant|farm_info"),
        hero.areaId,
        "assistant|farm_info",
      ),
      "common|area_conf": areaConf,
      "common|hunt": buildHuntBlock(area.spawns),
      "bank|info": chrome.block("bank|info"),
      "user|smiles": chrome.block("user|smiles"),
      "common|antimat": chrome.block("common|antimat"),
      "common|event_conf": chrome.block("common|event_conf"),
      "common|menu_link_status": buildMenuLinkStatus(this.policy.menuLinks),
      "common|front_status": chrome.block("common|front_status"),
      "common|area_capture_info": overlayCaptureAreaId(
        chrome.block("common|area_capture_info"),
        hero.areaId,
      ),
      "common|occurrences_conf": chrome.block("common|occurrences_conf"),
      "common|farm_agregate": chrome.block("common|farm_agregate"),
    };
  }

  private async requireHero(accountId: number) {
    const hero = await this.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    return hero;
  }
}

function statusOk(): StatusOkBlock {
  return { status: 100 };
}
