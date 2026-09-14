import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { Hero } from "../modules/character/domain/hero.ts";
import type { CombatPort } from "../modules/combat/ports/combat-port.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import {
  KIND_NEUTRAL,
  spawnAreaForKind,
  type BattlegroundDefinition,
} from "../modules/battleground/domain/battleground-definition.ts";
import type { LiveBattlegroundMatch } from "../modules/battleground/application/battleground-matches.ts";
import {
  bgStatsPayload,
  instanceMapConf,
} from "../modules/battleground/domain/battleground-wire.ts";
import { huntHeroStatFields } from "../modules/combat/domain/combatant-fight-stats.ts";
import { HuntCombatLoadout } from "../modules/jugger-wire/application/hunt-combat-loadout.ts";
import { bootstrapHeroState } from "../modules/jugger-wire/application/bootstrap-hero-state.ts";
import { buildUserConf } from "../modules/jugger-wire/application/user-conf-block.ts";
import { locationAreaBlocks } from "../modules/jugger-wire/application/location-area-read.ts";
import { liveHonorProgress } from "../modules/jugger-wire/application/live-honor-progress.ts";
import type { BootstrapReadModel } from "../modules/jugger-wire/application/bootstrap-read-model.ts";
import type { EsrvOutbox } from "../modules/jugger-wire/application/esrv-outbox.ts";
import type { PresenceFanout } from "../modules/jugger-wire/application/presence-fanout.ts";
import type { PresenceService } from "../modules/world/application/presence-service.ts";
import type { WorldService } from "../modules/world/domain/world-service.ts";
import type { Clock } from "../shared/kernel/clock.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import type { UnreadMailQuery } from "../modules/mail/ports/unread-mail.ts";
import type { PartyMembershipQuery } from "../modules/party/ports/party-membership-query.ts";
import type { InstanceHuntWorld } from "../modules/instance/ports/instance-hunt.ts";
import type { QuestCatalog } from "../modules/quests/ports/quest-catalog.ts";

export type BattlegroundChromeDeps = Readonly<{
  definition: BattlegroundDefinition;
  characters: CharacterService;
  inventory: InventoryService;
  catalog: Catalog;
  combat: CombatPort;
  world: WorldService;
  clock: Clock;
  unitOfWork: UnitOfWork;
  presence: PresenceService;
  presenceFanout: PresenceFanout;
  outbox: EsrvOutbox;
  wake: Readonly<{ wake(accountId: number): void }>;
  bootstrap: BootstrapReadModel;
  unreadMail: UnreadMailQuery;
  party: PartyMembershipQuery;
  hunt: InstanceHuntWorld;
  quests: QuestCatalog;
}>;

export class BattlegroundChrome {
  constructor(private readonly deps: BattlegroundChromeDeps) {}

  async teleportSide(heroId: number, kind: number, copyId: number): Promise<void> {
    await this.deps.characters.setKind({ characterId: heroId, kind });
    await this.deps.characters.setArea({
      characterId: heroId,
      areaId: spawnAreaForKind(this.deps.definition, kind),
      moveReadyAt: null,
      instanceCopyId: copyId,
    });
  }

  async kickHero(hero: Hero, destAreaId: string, fromCopyId: number | null): Promise<void> {
    const dest = destAreaId || this.deps.definition.returnAreaId;
    const moved = await this.deps.unitOfWork.run(async () => {
      const locked = await this.deps.characters.lockByAccountId(hero.accountId);
      const fromAreaId = locked.areaId;
      await this.deps.characters.setKind({ characterId: locked.id, kind: KIND_NEUTRAL });
      await this.deps.characters.setArea({
        characterId: locked.id,
        areaId: dest,
        moveReadyAt: null,
        instanceCopyId: null,
      });
      return { fromAreaId, hero: await this.deps.characters.getById(locked.id) };
    });
    if (!moved.hero) throw new Error(`Hero ${hero.id} is missing after battleground kick`);
    await this.deps.presenceFanout.afterMove(hero.accountId, moved.fromAreaId, dest, fromCopyId);
    await this.pushLocation(moved.hero);
  }

  async pushEnter(
    fromAreaId: string,
    hero: Hero,
    kind: number,
    match: LiveBattlegroundMatch,
  ): Promise<void> {
    const viewer = match.players.get(hero.id);
    if (!viewer) throw new Error(`Battleground hero ${hero.id} is missing after start`);
    await this.deps.presenceFanout.afterMove(hero.accountId, fromAreaId, hero.areaId, null);
    const location = await this.locationChrome(hero);
    this.deps.outbox.enqueue(hero.accountId, {
      ...location,
      "arena|bg_stats": bgStatsPayload({ match, viewer, finished: false }),
      "common|instance_map_conf": instanceMapConf({
        definition: this.deps.definition,
        nick: viewer.nick,
        viewerAreaId: hero.areaId,
        viewerKind: kind,
        users: [...match.players.values()],
        areasByHero: await this.areasByHero(match.players.keys()),
      }),
    });
    this.deps.wake.wake(hero.accountId);
  }

  async pushHonorWindows(accountId: number): Promise<void> {
    const hero = await this.requireHeroByAccount(accountId);
    this.deps.outbox.enqueue(accountId, {
      "user|unitframe": await this.deps.bootstrap.unitframe(accountId),
      "user|conf": buildUserConf(hero, await liveHonorProgress(this.deps.catalog, hero)),
    });
    this.deps.wake.wake(accountId);
  }

  async pushMapAndStats(match: LiveBattlegroundMatch): Promise<void> {
    const areasByHero = await this.areasByHero(match.players.keys());
    for (const player of match.players.values()) {
      const hero = await this.requireHeroById(player.heroId);
      this.deps.outbox.enqueue(player.accountId, {
        "arena|bg_stats": bgStatsPayload({ match, viewer: player, finished: false }),
        "common|instance_map_conf": instanceMapConf({
          definition: this.deps.definition,
          nick: player.nick,
          viewerAreaId: hero.areaId,
          viewerKind: player.kind,
          users: [...match.players.values()],
          areasByHero,
        }),
      });
      this.deps.wake.wake(player.accountId);
    }
  }

  async fighterInput(hero: Hero) {
    await this.deps.inventory.ensureStarterInventory(hero.id);
    const locked = await this.deps.unitOfWork.run(async () => {
      const current = await this.deps.characters.lockByAccountId(hero.accountId);
      await this.deps.characters.syncResources({ characterId: current.id });
      return this.requireHeroByAccount(hero.accountId);
    });
    const appearance = await this.deps.catalog.appearance(locked.kind, locked.gender);
    const loadout = await new HuntCombatLoadout(this.deps.inventory, this.deps.catalog).snapshot(
      locked.id,
    );
    return {
      accountId: locked.accountId,
      heroId: locked.id,
      heroNick: locked.nick,
      heroLevel: locked.level,
      heroKind: locked.kind,
      heroHp: locked.hp,
      heroMaxHp: locked.maxHp,
      heroMp: locked.mp,
      heroMaxMp: locked.maxMp,
      ...huntHeroStatFields(await this.deps.characters.combatFightStats(locked.id)),
      loadout,
      avatar: appearance.avatarSmall,
      body: locked.body,
      sk: String(locked.sk),
    };
  }

  async requireHeroByAccount(accountId: number): Promise<Hero> {
    const hero = await this.deps.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    return hero;
  }

  async requireHeroById(heroId: number): Promise<Hero> {
    const hero = await this.deps.characters.getById(heroId);
    if (!hero) throw new Error(`Hero ${heroId} is missing`);
    return hero;
  }

  private async pushLocation(hero: Hero): Promise<void> {
    this.deps.outbox.enqueue(hero.accountId, await this.locationChrome(hero));
    this.deps.wake.wake(hero.accountId);
  }

  private async locationChrome(hero: Hero): Promise<Readonly<Record<string, unknown>>> {
    const location = await locationAreaBlocks(
      this.deps.world,
      this.deps.catalog,
      hero,
      this.deps.clock,
      this.deps.hunt,
      this.deps.quests,
    );
    return {
      state: await bootstrapHeroState({
        hero,
        accountId: hero.accountId,
        combat: this.deps.combat,
        world: this.deps.world,
        clock: this.deps.clock,
        unreadMail: this.deps.unreadMail,
        party: this.deps.party,
      }),
      "common|area_conf": location.areaConf,
      "common|hunt": location.hunt,
      "chat|area_population": await this.deps.presence.listPopulation(
        hero.areaId,
        hero.instanceCopyId,
      ),
      "user|unitframe": await this.deps.bootstrap.unitframe(hero.accountId),
      "user|conf": buildUserConf(hero, await liveHonorProgress(this.deps.catalog, hero)),
      "user|view": await this.deps.bootstrap.view(hero.accountId),
      "user|skills": await this.deps.bootstrap.skills(hero.accountId),
    };
  }

  private async areasByHero(heroIds: Iterable<number>): Promise<Map<number, string>> {
    const areas = new Map<number, string>();
    for (const heroId of heroIds) {
      const hero = await this.requireHeroById(heroId);
      areas.set(heroId, hero.areaId);
    }
    return areas;
  }
}
