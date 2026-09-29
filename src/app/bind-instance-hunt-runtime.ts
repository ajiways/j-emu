import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { BattlegroundCatalog } from "../modules/battleground/ports/battleground-catalog.ts";
import type { CharacterModule } from "../modules/character/character-module.ts";
import type { CombatModule } from "../modules/combat/combat-module.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { InstanceModule } from "../modules/instance/instance-module.ts";
import type { PartyModule } from "../modules/party/party-module.ts";
import type { QuestCatalog } from "../modules/quests/ports/quest-catalog.ts";
import type { QuestLootNeeded } from "../modules/quests/ports/quest-loot-needed.ts";
import type { WorldService } from "../modules/world/domain/world-service.ts";
import type { PresenceService } from "../modules/world/application/presence-service.ts";
import type { Clock } from "../shared/kernel/clock.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import type { RandomSource } from "../modules/combat/domain/random-source.ts";
import type { HuntAreaFanout } from "../modules/jugger-wire/application/hunt-area-fanout.ts";
import type { EsrvOutbox } from "../modules/jugger-wire/application/esrv-outbox.ts";
import type { PresenceFanout } from "../modules/jugger-wire/application/presence-fanout.ts";
import type { PartySnapshot } from "../modules/jugger-wire/application/party-snapshot.ts";
import type { UnreadMailQuery } from "../modules/mail/ports/unread-mail.ts";
import { createChatHuntSettlement } from "./create-chat-hunt-settlement.ts";
import type { ChatDesk } from "./chat-desk.ts";
import { DungeonPersonalGrant } from "./dungeon-personal-grant.ts";
import { HEROISM_RULES } from "./heroism-rules.ts";
import { HuntLockRelease } from "./hunt-lock-release.ts";
import { InstanceDesk } from "./instance-desk.ts";
import { InstanceHuntLockRelease } from "./instance-hunt-lock-release.ts";
import type { PartyNotify } from "./party-notify.ts";
import type { PvpFightHonorCache } from "./pvp-fight-honor-cache.ts";

export function bindInstanceHuntRuntime(input: {
  instance: InstanceModule;
  characters: CharacterModule;
  parties: PartyModule;
  partySnapshot: PartySnapshot;
  combat: CombatModule;
  world: WorldService;
  catalog: Catalog;
  battlegrounds: BattlegroundCatalog;
  clock: Clock;
  unitOfWork: UnitOfWork;
  presence: PresenceService;
  presenceFanout: PresenceFanout;
  huntFanout: HuntAreaFanout;
  chat: ChatDesk;
  outbox: EsrvOutbox;
  wake: Readonly<{ wake(accountId: number): void }>;
  unreadMail: UnreadMailQuery;
  quests: QuestCatalog;
  inventory: InventoryService;
  lootRandom: RandomSource;
  partyNotify: PartyNotify;
  lootNeeded: QuestLootNeeded;
  pvpHonor: PvpFightHonorCache;
}): Readonly<{
  instanceDesk: InstanceDesk;
  instanceHuntRelease: InstanceHuntLockRelease;
}> {
  const instanceDesk = new InstanceDesk({
    instances: input.instance.service,
    hunt: input.instance.hunt,
    characters: input.characters.service,
    parties: input.parties.service,
    partySnapshot: input.partySnapshot,
    combat: input.combat.combat,
    world: input.world,
    catalog: input.catalog,
    clock: input.clock,
    unitOfWork: input.unitOfWork,
    presence: input.presence,
    presenceFanout: input.presenceFanout,
    chat: input.chat,
    outbox: input.outbox,
    wake: input.wake,
    unreadMail: input.unreadMail,
    battlegrounds: input.battlegrounds,
    quests: input.quests,
  });
  const dungeonGrant = new DungeonPersonalGrant(input.instance.hunt, input.instance.service);
  input.combat.bindSettlement(
    createChatHuntSettlement({
      unitOfWork: input.unitOfWork,
      catalog: input.catalog,
      characters: input.characters.service,
      inventory: input.inventory,
      lootRandom: input.lootRandom,
      party: input.parties.service,
      partyBag: input.parties.bag,
      partyNotify: input.partyNotify,
      chat: input.chat,
      bestiary: input.characters.bestiary,
      lootNeeded: input.lootNeeded,
      heroism: HEROISM_RULES,
      pvpHonor: input.pvpHonor,
      dungeonGrant,
    }),
  );
  return {
    instanceDesk,
    instanceHuntRelease: new InstanceHuntLockRelease(
      new HuntLockRelease(input.world, input.huntFanout),
      input.instance.hunt,
      input.instance.service,
      instanceDesk,
      input.huntFanout,
      dungeonGrant,
      input.outbox,
      input.wake,
    ),
  };
}
