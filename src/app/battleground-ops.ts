import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { BattlegroundCatalog } from "../modules/battleground/ports/battleground-catalog.ts";
import { BattlegroundQueue } from "../modules/battleground/application/battleground-queue.ts";
import { BattlegroundMatches } from "../modules/battleground/application/battleground-matches.ts";
import { PostgresBattlegroundHistory } from "../modules/battleground/infrastructure/postgres-battleground-history.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { CombatPort } from "../modules/combat/ports/combat-port.ts";
import type { FightTerminalObserver } from "../modules/combat/ports/fight-terminal-observer.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { InstanceService } from "../modules/instance/application/instance-service.ts";
import type { InstanceHuntWorld } from "../modules/instance/ports/instance-hunt.ts";
import type { FightWireMapper } from "../modules/jugger-wire/application/fight-wire-mapper.ts";
import type { BootstrapReadModel } from "../modules/jugger-wire/application/bootstrap-read-model.ts";
import type { EsrvOutbox } from "../modules/jugger-wire/application/esrv-outbox.ts";
import type { PresenceFanout } from "../modules/jugger-wire/application/presence-fanout.ts";
import type { PresenceService } from "../modules/world/application/presence-service.ts";
import type { WorldService } from "../modules/world/domain/world-service.ts";
import type { Clock } from "../shared/kernel/clock.ts";
import type { DelayScheduler } from "../shared/kernel/delay-scheduler.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import type { PostgresDatabase } from "../infrastructure/postgres/database.ts";
import type { UnreadMailQuery } from "../modules/mail/ports/unread-mail.ts";
import type { PartyMembershipQuery } from "../modules/party/ports/party-membership-query.ts";
import type { QuestCatalog } from "../modules/quests/ports/quest-catalog.ts";
import type { ChatDesk } from "./chat-desk.ts";
import { BattlegroundDesk } from "./battleground-desk.ts";
import { BattlegroundMatchRuntime } from "./battleground-match-runtime.ts";

export async function createBattlegroundOps(input: {
  database: PostgresDatabase;
  catalog: Catalog;
  battlegrounds: BattlegroundCatalog;
  characters: CharacterService;
  inventory: InventoryService;
  combat: CombatPort;
  fightWire: FightWireMapper;
  instances: InstanceService;
  hunt: InstanceHuntWorld;
  world: WorldService;
  clock: Clock;
  delay: DelayScheduler;
  unitOfWork: UnitOfWork;
  presence: PresenceService;
  presenceFanout: PresenceFanout;
  outbox: EsrvOutbox;
  wake: Readonly<{ wake(accountId: number): void }>;
  bootstrap: BootstrapReadModel;
  chat: ChatDesk;
  unreadMail: UnreadMailQuery;
  party: PartyMembershipQuery;
  quests: QuestCatalog;
}): Promise<BattlegroundDesk> {
  const definition = await input.battlegrounds.playable();
  const history = new PostgresBattlegroundHistory(input.database);
  const matches = new BattlegroundMatches();
  const bind: { desk: BattlegroundDesk | null } = { desk: null };
  const queue = new BattlegroundQueue(definition, input.clock, input.delay, (invite) => {
    if (!bind.desk) throw new Error("Battleground desk is missing for invite");
    bind.desk.pushInvite(invite);
  });
  const runtime = new BattlegroundMatchRuntime({
    definition,
    queue,
    matches,
    history,
    instances: input.instances,
    characters: input.characters,
    inventory: input.inventory,
    catalog: input.catalog,
    combat: input.combat,
    fightWire: input.fightWire,
    world: input.world,
    clock: input.clock,
    delay: input.delay,
    unitOfWork: input.unitOfWork,
    presence: input.presence,
    presenceFanout: input.presenceFanout,
    outbox: input.outbox,
    wake: input.wake,
    bootstrap: input.bootstrap,
    chat: input.chat,
    unreadMail: input.unreadMail,
    party: input.party,
    hunt: input.hunt,
    quests: input.quests,
  });
  bind.desk = new BattlegroundDesk({
    definition,
    characters: input.characters,
    catalog: input.battlegrounds,
    history,
    queue,
    runtime,
    outbox: input.outbox,
    wake: input.wake,
  });
  return bind.desk;
}

export function chainFightTerminal(
  first: FightTerminalObserver,
  second: FightTerminalObserver,
): FightTerminalObserver {
  return {
    async afterFinished(notice) {
      await first.afterFinished(notice);
      await second.afterFinished(notice);
    },
  };
}
