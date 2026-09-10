import { partyCreateInput } from "./party-form.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { Hero } from "../modules/character/domain/hero.ts";
import type { CombatPort } from "../modules/combat/ports/combat-port.ts";
import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { DungeonDefinition } from "../modules/catalog/domain/dungeon-definition.ts";
import type { Clock } from "../shared/kernel/clock.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import type { EnterCopyResult } from "../modules/instance/application/instance-service.ts";
import type { InstanceService } from "../modules/instance/application/instance-service.ts";
import { instanceConf, instanceCreatedChat } from "../modules/instance/domain/instance-wire.ts";
import { isCopyLive } from "../modules/instance/domain/instance-copy.ts";
import type { PartyService } from "../modules/party/application/party-service.ts";
import type { PartySnapshot } from "../modules/jugger-wire/application/party-snapshot.ts";
import type { ChatDesk } from "./chat-desk.ts";
import type { PresenceFanout } from "../modules/jugger-wire/application/presence-fanout.ts";
import { locationAreaBlocks } from "../modules/jugger-wire/application/location-area-read.ts";
import { bootstrapHeroState } from "../modules/jugger-wire/application/bootstrap-hero-state.ts";
import type { EsrvOutbox } from "../modules/jugger-wire/application/esrv-outbox.ts";
import type { WorldService } from "../modules/world/domain/world-service.ts";
import type { PresenceService } from "../modules/world/application/presence-service.ts";
import type { UnreadMailQuery } from "../modules/mail/ports/unread-mail.ts";
import type { InstanceHuntWorld } from "../modules/instance/ports/instance-hunt.ts";

export type InstanceTravelPlan = Readonly<{
  copyId: number | null;
  enter: EnterCopyResult | null;
  autoParty: boolean;
}>;

export type InstanceDeskDeps = Readonly<{
  instances: InstanceService;
  hunt: InstanceHuntWorld;
  characters: CharacterService;
  parties: PartyService;
  partySnapshot: PartySnapshot;
  combat: CombatPort;
  world: WorldService;
  catalog: Catalog;
  clock: Clock;
  unitOfWork: UnitOfWork;
  presence: PresenceService;
  presenceFanout: PresenceFanout;
  chat: ChatDesk;
  outbox: EsrvOutbox;
  wake: Readonly<{ wake(accountId: number): void }>;
  unreadMail: UnreadMailQuery;
}>;

export class InstanceDesk {
  constructor(private readonly deps: InstanceDeskDeps) {}

  async prepareTravel(hero: Hero, destAreaId: string): Promise<InstanceTravelPlan> {
    const start = await this.deps.instances.dungeonByStartArea(destAreaId);
    if (start) {
      const hadParty = await this.deps.parties.inParty(hero.id);
      await this.deps.parties.ensureParty(hero.id, hero.accountId, partyCreateInput({}));
      const entered = await this.deps.instances.enterCopy(
        hero.id,
        hero.level,
        destAreaId,
        await this.mateCopyIds(hero.id),
      );
      await this.deps.parties.tagInstanceArtikul(hero.id, entered.dungeon.artikulId);
      return { copyId: entered.copy.id, enter: entered, autoParty: !hadParty };
    }
    if (hero.instanceCopyId === null) return { copyId: null, enter: null, autoParty: false };
    const copy = await this.deps.instances.getCopy(hero.instanceCopyId);
    if (!copy) {
      throw new Error(`Hero ${hero.id} instance copy ${hero.instanceCopyId} is missing`);
    }
    const dungeon = await this.requireDungeon(copy.artikulId);
    if (destAreaId === dungeon.parentAreaId) {
      return { copyId: null, enter: null, autoParty: false };
    }
    if (!this.deps.instances.isDungeonArea(dungeon, destAreaId)) {
      throw new Error(`Hero ${hero.id} cannot travel from copy ${copy.id} to area ${destAreaId}`);
    }
    if (!isCopyLive(copy, this.deps.clock.unixSeconds())) {
      await this.deps.instances.requireLiveCopy(copy.id);
    }
    return { copyId: copy.id, enter: null, autoParty: false };
  }

  async decorateComeIn(
    blocks: Readonly<Record<string, unknown>>,
    plan: InstanceTravelPlan,
    accountId: number,
    heroId: number,
  ): Promise<Readonly<Record<string, unknown>>> {
    if (!plan.enter) return blocks;
    const extra: Record<string, unknown> = {
      ...blocks,
      "common|instance_conf": instanceConf(
        plan.enter.dungeon.artikulId,
        plan.enter.dungeon.hasClear,
      ),
    };
    if (plan.autoParty) {
      const party = await this.deps.partySnapshot.restore(heroId);
      if (!party) throw new Error(`Auto-party chrome for hero ${heroId} is missing`);
      extra["party|create"] = { status: 100 };
      extra["party|members"] = party["party|members"];
      extra["party|settings"] = party["party|settings"];
      extra["party|bag"] = party["party|bag"];
    }
    if (plan.enter.created) {
      await this.deps.chat.deliverSystem(
        accountId,
        instanceCreatedChat(plan.enter.dungeon.title, plan.enter.dungeon.durationSec),
      );
    }
    return extra;
  }

  async ensureResurrectArea(hero: Hero): Promise<void> {
    if (hero.instanceCopyId === null) return;
    const copy = await this.deps.instances.requireLiveCopy(hero.instanceCopyId);
    const dungeon = await this.requireDungeon(copy.artikulId);
    if (hero.areaId === dungeon.startAreaId) return;
    await this.deps.characters.setArea({
      characterId: hero.id,
      areaId: dungeon.startAreaId,
      moveReadyAt: hero.moveReadyAt,
      instanceCopyId: copy.id,
    });
  }

  async sweepExpired(): Promise<void> {
    for (const copy of await this.deps.instances.listExpired()) {
      await this.kickCopy(copy.id, copy.artikulId, true);
    }
  }

  async kickIfPending(copyId: number): Promise<void> {
    const copy = await this.deps.instances.getCopy(copyId);
    if (!copy) throw new Error(`Instance copy ${copyId} is missing`);
    if (!copy.pendingKick && isCopyLive(copy, this.deps.clock.unixSeconds())) return;
    await this.kickCopy(copy.id, copy.artikulId, !isCopyLive(copy, this.deps.clock.unixSeconds()));
  }

  private async kickCopy(copyId: number, artikulId: string, expired: boolean): Promise<void> {
    const dungeon = await this.requireDungeon(artikulId);
    let blocked = false;
    for (const occupant of await this.deps.characters.listInCopy(copyId)) {
      if ((await this.deps.combat.activeFightId(occupant.accountId)) !== null) {
        blocked = true;
        continue;
      }
      await this.kickHero(occupant.accountId, dungeon, copyId);
    }
    if (expired) await this.deps.instances.setPendingKick(copyId, blocked);
  }

  private async kickHero(
    accountId: number,
    dungeon: DungeonDefinition,
    fromCopyId: number,
  ): Promise<void> {
    const moved = await this.deps.unitOfWork.run(async () => {
      const locked = await this.deps.characters.lockByAccountId(accountId);
      const fromAreaId = locked.areaId;
      await this.deps.characters.setArea({
        characterId: locked.id,
        areaId: dungeon.parentAreaId,
        moveReadyAt: null,
        instanceCopyId: null,
      });
      return { fromAreaId, hero: await this.deps.characters.getById(locked.id) };
    });
    if (!moved.hero)
      throw new Error(`Hero for account ${accountId} is missing after instance kick`);
    await this.deps.presenceFanout.afterMove(
      accountId,
      moved.fromAreaId,
      dungeon.parentAreaId,
      fromCopyId,
    );
    const location = await locationAreaBlocks(
      this.deps.world,
      this.deps.catalog,
      moved.hero,
      this.deps.clock,
      this.deps.hunt,
    );
    this.deps.outbox.enqueue(accountId, {
      state: await bootstrapHeroState({
        hero: moved.hero,
        accountId,
        combat: this.deps.combat,
        world: this.deps.world,
        clock: this.deps.clock,
        unreadMail: this.deps.unreadMail,
        party: this.deps.parties,
      }),
      "common|area_conf": location.areaConf,
      "common|hunt": location.hunt,
      "chat|area_population": await this.deps.presence.listPopulation(
        moved.hero.areaId,
        moved.hero.instanceCopyId,
      ),
    });
    this.deps.wake.wake(accountId);
  }

  private async mateCopyIds(heroId: number): Promise<readonly number[]> {
    const mem = await this.deps.parties.membership(heroId);
    if (!mem) return [];
    const ids: number[] = [];
    for (const row of await this.deps.parties.listMembers(mem.party.id)) {
      if (row.heroId === heroId) continue;
      const mate = await this.deps.characters.getById(row.heroId);
      if (!mate) throw new Error(`Party mate hero ${row.heroId} is missing`);
      if (mate.instanceCopyId !== null) ids.push(mate.instanceCopyId);
    }
    return ids;
  }

  private async requireDungeon(artikulId: string): Promise<DungeonDefinition> {
    const dungeon = await this.deps.instances.dungeonByArtikul(artikulId);
    if (!dungeon) throw new Error(`Dungeon artikul ${artikulId} is missing`);
    return dungeon;
  }
}
