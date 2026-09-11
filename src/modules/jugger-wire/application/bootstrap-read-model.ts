import type { SkillDefinition } from "../../catalog/domain/skill-definition.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import { totalHeroSkills } from "../../character/domain/equipment-skill-totals.ts";
import type { CharacterService } from "../../character/application/character-service.ts";
import type { Hero } from "../../character/domain/hero.ts";
import type { Clock } from "../../../shared/kernel/clock.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";
import type { WorldService } from "../../world/domain/world-service.ts";
import type { CombatPort } from "../../combat/ports/combat-port.ts";
import type { CommonConfBlock } from "../../content/domain/bootstrap-content.ts";
import { overlayCaptureAreaId } from "./chrome-area-overlay.ts";
import { withHttpsFproxy } from "./personal-details-wire.ts";
import { artifactSkillWireMap } from "./artifact-skill-wire.ts";
import { artifactInstanceOverlay } from "./artifact-instance-overlay.ts";
import { buildEquippedArtifact } from "./equipped-artifact-block.ts";
import { equippedSkillBonuses } from "./equipped-skill-bonuses.ts";
import { type HeroStateBlock } from "./hero-state-block.ts";
import { bootstrapFightId, bootstrapHeroState } from "./bootstrap-hero-state.ts";
import { type HuntBlock } from "./hunt-block.ts";
import { locationAreaBlocks } from "./location-area-read.ts";
import { buildMenuLinkStatus } from "./menu-link-status-block.ts";
import { buildChatConf, type ChatConfPolicy } from "./chat-conf-block.ts";
import { buildUserBag, type UserBagBlock } from "./user-bag-block.ts";
import { buildUserPocket } from "./user-pocket-block.ts";
import { buildUserConf } from "./user-conf-block.ts";
import { emptyUserMagic } from "./user-magic-block.ts";
import { liveHonorProgress } from "./live-honor-progress.ts";
import { buildUserSkills, skillsExpireBlock, type UserSkillsBlock } from "./user-skills-block.ts";
import { userProfessionsWire } from "../../character/domain/profession-wire.ts";
import { buildUserUnitframe, type UserUnitframeBlock } from "./user-unitframe-block.ts";
import { wornSetPortrait } from "./worn-set-portrait.ts";
import { buildUserView, type UserViewBlock } from "./user-view-block.ts";
import { buildWelcomeMessage } from "./welcome-message-block.ts";
import { buildUseMutation } from "./use-mutation-block.ts";
import { buildTravelMutation } from "./travel-mutation-block.ts";
import { upgradeMutation } from "./upgrade-mutation-block.ts";
import type { GearUpgradeResult } from "../../inventory/domain/apply-gear-upgrade.ts";
import type { PresenceService } from "../../world/application/presence-service.ts";
import type { UnreadMailQuery } from "../../mail/ports/unread-mail.ts";
import type { PartyMembershipQuery } from "../../party/ports/party-membership-query.ts";
import type { FightWireMapper } from "./fight-wire-mapper.ts";
import type { PartySnapshot } from "./party-snapshot.ts";
import type { InstanceHuntWorld } from "../../instance/ports/instance-hunt.ts";
import type { ProfessionsService } from "../../professions/application/professions-service.ts";
import type { QuestCatalog } from "../../quests/ports/quest-catalog.ts";
import type { QuestService } from "../../quests/application/quest-service.ts";
import { bookTrioFromSnapshot } from "./quest-book-trio.ts";

export type { HuntBlock, UserUnitframeBlock, HeroStateBlock };

export class BootstrapReadModel {
  constructor(
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly catalog: Catalog,
    private readonly world: WorldService,
    private readonly combat: CombatPort,
    private readonly clock: Clock,
    private readonly presence: PresenceService,
    private readonly fightWire: FightWireMapper,
    private readonly unreadMail: UnreadMailQuery,
    private readonly party: PartyMembershipQuery,
    private readonly partySnapshot: PartySnapshot,
    private readonly instanceHunt: InstanceHuntWorld,
    private readonly professions: ProfessionsService,
    private readonly quests: QuestService,
    private readonly questCatalog: QuestCatalog,
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

  async bag(accountId: number): Promise<UserBagBlock> {
    const hero = await this.requireHero(accountId);
    return buildUserBag(hero, this.inventory, this.catalog);
  }

  async state(accountId: number): Promise<HeroStateBlock> {
    const hero = await this.requireHero(accountId);
    return this.heroState(hero, accountId);
  }

  async travelMutation(
    accountId: number,
    kind: "COME_IN" | "exit",
  ): Promise<Readonly<Record<string, unknown>>> {
    const hero = await this.requireHero(accountId);
    return buildTravelMutation({
      accountId,
      actionKey: kind === "COME_IN" ? "common|action" : "common|exit",
      actionBlock: kind === "COME_IN" ? { status: 100, action: "COME_IN" } : { status: 100 },
      characters: this.characters,
      catalog: this.catalog,
      world: this.world,
      areaPopulation: await this.presence.listPopulation(hero.areaId, hero.instanceCopyId),
      unitframe: await this.unitframe(accountId),
      skills: await this.skills(accountId),
      clock: this.clock,
      state: await this.heroState(hero, accountId),
      instanceHunt: this.instanceHunt,
      quests: this.questCatalog,
    });
  }

  async hunt(accountId: number): Promise<HuntBlock> {
    const hero = await this.requireHero(accountId);
    return (
      await locationAreaBlocks(
        this.world,
        this.catalog,
        hero,
        this.clock,
        this.instanceHunt,
        this.questCatalog,
      )
    ).hunt;
  }

  async unitframe(accountId: number): Promise<UserUnitframeBlock> {
    const hero = await this.requireFreshHero(accountId);
    const level = await this.catalog.level(hero.level);
    const appearance = await this.catalog.appearance(hero.kind, hero.gender);
    const hud = await this.catalog.hudDefaults();
    const fightId = await bootstrapFightId(this.combat, accountId);
    const portrait = await wornSetPortrait(
      await this.inventory.list(hero.id),
      this.catalog,
      hero.gender,
    );
    return buildUserUnitframe(
      hero,
      level,
      appearance,
      hud,
      await liveHonorProgress(this.catalog, hero),
      fightId !== null,
      fightId,
      portrait === null ? appearance.avatarSmall : portrait.small,
    );
  }

  async skills(accountId: number): Promise<UserSkillsBlock> {
    const hero = await this.requireFreshHero(accountId);
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
    const hero = await this.requireFreshHero(accountId);
    const level = await this.catalog.level(hero.level);
    const appearance = await this.catalog.appearance(hero.kind, hero.gender);
    const items = await this.inventory.list(hero.id);
    const artifacts = [];
    for (const item of items) {
      if (item.location.kind !== "equipment" && item.location.kind !== "tempeffect") continue;
      const definition = await this.catalog.artifact(item.artifactId);
      if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
      const overlay = artifactInstanceOverlay(definition, item);
      artifacts.push(
        buildEquippedArtifact(
          item,
          definition,
          await artifactSkillWireMap(overlay.skills, this.catalog, overlay.upgradeBySkill),
          overlay,
        ),
      );
    }
    const portrait = await wornSetPortrait(items, this.catalog, hero.gender);
    return buildUserView(
      hero,
      appearance,
      level,
      artifacts,
      portrait === null ? appearance.avatarBig : portrait.big,
    );
  }

  async equipmentMutation(accountId: number): Promise<Readonly<Record<string, unknown>>> {
    const hero = await this.requireHero(accountId);
    return {
      "common|action": { status: 100 },
      "user|bag": await buildUserBag(hero, this.inventory, this.catalog),
      "user|view": await this.view(accountId),
      "user|pocket": await buildUserPocket(
        this.inventory,
        this.catalog,
        hero.id,
        this.policy.pocketCapacity,
      ),
      "user|skills": await this.skills(accountId),
      "user|unitframe": await this.unitframe(accountId),
      "user|conf": buildUserConf(hero, await liveHonorProgress(this.catalog, hero)),
      state: await this.heroState(hero, accountId),
    };
  }

  async useMutation(
    accountId: number,
    options: Readonly<{ msgText: string | null; includeView: boolean }>,
  ): Promise<Readonly<Record<string, unknown>>> {
    const hero = await this.requireFreshHero(accountId);
    const base = {
      hero,
      inventory: this.inventory,
      catalog: this.catalog,
      pocketCapacity: this.policy.pocketCapacity,
      unitframe: await this.unitframe(accountId),
      skills: await this.skills(accountId),
      state: await this.heroState(hero, accountId),
      msgText: options.msgText,
    };
    if (options.includeView) {
      return buildUseMutation({ ...base, includeView: true, view: await this.view(accountId) });
    }
    return buildUseMutation({ ...base, includeView: false });
  }

  async resurrectMutation(accountId: number): Promise<Readonly<Record<string, unknown>>> {
    const hero = await this.requireHero(accountId);
    const location = await locationAreaBlocks(
      this.world,
      this.catalog,
      hero,
      this.clock,
      this.instanceHunt,
      this.questCatalog,
    );
    return {
      "common|action": { status: 100 },
      state: await this.heroState(hero, accountId),
      "user|unitframe": await this.unitframe(accountId),
      "user|skills": await this.skills(accountId),
      "common|area_conf": location.areaConf,
      "common|hunt": location.hunt,
      "chat|area_population": await this.presence.listPopulation(hero.areaId, hero.instanceCopyId),
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
      state: await this.heroState(hero, accountId),
    };
  }

  async upgradeMutation(
    accountId: number,
    result: GearUpgradeResult,
  ): Promise<Readonly<Record<string, unknown>>> {
    const hero = await this.requireHero(accountId);
    return upgradeMutation(
      result,
      await buildUserBag(hero, this.inventory, this.catalog),
      await this.skills(accountId),
    );
  }

  async init(accountId: number): Promise<Readonly<Record<string, unknown>>> {
    const hero = await this.requireHero(accountId);
    const chrome = await this.catalog.chrome();
    const book = bookTrioFromSnapshot(await this.quests.bookSnapshot(hero.id, "started"));
    return {
      "common|init": { status: 100 },
      "common|conf": await this.catalog.commonConf(),
      state: await this.heroState(hero, accountId),
      "user|bag": await buildUserBag(hero, this.inventory, this.catalog),
      "user|pocket": await buildUserPocket(
        this.inventory,
        this.catalog,
        hero.id,
        this.policy.pocketCapacity,
      ),
      "user|magic": emptyUserMagic(),
      "user|conf": buildUserConf(hero, await liveHonorProgress(this.catalog, hero)),
      "user|personal_details": {
        status: 100,
        info: withHttpsFproxy(await this.characters.personalDetails(accountId)),
      },
      "user|skills": await this.skills(accountId),
      "user|professions": userProfessionsWire(
        await this.characters.professionLicenses(hero.id),
        hero.level,
      ),
      "pet|list": chrome.block("pet|list"),
      "user|mount_list": chrome.block("user|mount_list"),
      ...book,
      "user|campaigns": chrome.block("user|campaigns"),
    };
  }

  async init2(accountId: number): Promise<Readonly<Record<string, unknown>>> {
    const hero = await this.requireHero(accountId);
    const resume = await this.combat.resumeFight(accountId);
    const location = await locationAreaBlocks(
      this.world,
      this.catalog,
      hero,
      this.clock,
      this.instanceHunt,
      this.questCatalog,
    );
    const chrome = await this.catalog.chrome();
    const partyBlocks = await this.partySnapshot.restore(hero.id);
    return {
      "common|init2": { status: 100 },
      state: await this.heroState(hero, accountId),
      "user|unitframe": await this.unitframe(accountId),
      "chat|conf": buildChatConf(hero.accountId, this.policy.chat),
      "chat|area_population": await this.presence.listPopulation(hero.areaId, hero.instanceCopyId),
      "chat|message": buildWelcomeMessage(hero, chrome.welcomeTemplate, this.clock),
      "friend|info": chrome.block("friend|info"),
      "user|action_stats": chrome.block("user|action_stats"),
      "arena|great_fights": chrome.block("arena|great_fights"),
      "user|skills": skillsExpireBlock(),
      "user|time_to_next_achievement": chrome.block("user|time_to_next_achievement"),
      "assistant|farm_info": await this.professions.farmInfo(hero.areaId),
      "common|area_conf": location.areaConf,
      "common|hunt": location.hunt,
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
      ...(resume
        ? {
            "fight|conf": this.fightWire.fightConfiguration(
              resume,
              hero.instanceCopyId === null
                ? {}
                : { canLeave: 0, instanceId: String(hero.instanceCopyId) },
            ),
          }
        : {}),
      ...(partyBlocks !== null ? partyBlocks : {}),
    };
  }

  private heroState(hero: Hero, accountId: number) {
    return bootstrapHeroState({
      hero,
      accountId,
      combat: this.combat,
      world: this.world,
      clock: this.clock,
      unreadMail: this.unreadMail,
      party: this.party,
    });
  }

  private async requireFreshHero(accountId: number): Promise<Hero> {
    const hero = await this.requireHero(accountId);
    const purged = await this.inventory.purgeExpiredDrinks(hero.id, this.clock.unixSeconds());
    if (!purged) return hero;
    return this.characters.applyEquipmentVitals(
      hero,
      await this.inventory.equippedSkillBonuses(hero.id),
    );
  }

  private async requireHero(accountId: number) {
    const hero = await this.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    return hero;
  }
}
