import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { BattlegroundCatalog } from "../modules/battleground/ports/battleground-catalog.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { HeroBestiary } from "../modules/character/ports/hero-bestiary.ts";
import type { CombatPort } from "../modules/combat/ports/combat-port.ts";
import type { RandomSource } from "../modules/combat/domain/random-source.ts";
import type { ContentEditor } from "../modules/content/ports/content-editor.ts";
import type { IdentityService } from "../modules/identity/application/identity-service.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { AuctionService } from "../modules/auction/application/auction-service.ts";
import type { MailService } from "../modules/mail/application/mail-service.ts";
import type { PartyJoinService } from "../modules/party/application/party-join-service.ts";
import type { PartyService } from "../modules/party/application/party-service.ts";
import type { CraftService } from "../modules/professions/application/craft-service.ts";
import type { ProfessionsService } from "../modules/professions/application/professions-service.ts";
import type { QuestService } from "../modules/quests/application/quest-service.ts";
import type { QuestCatalog } from "../modules/quests/ports/quest-catalog.ts";
import type { InstanceService } from "../modules/instance/application/instance-service.ts";
import type { DungeonHuntWorld } from "../modules/instance/application/dungeon-hunt-world.ts";
import type { InstanceHuntWorld } from "../modules/instance/ports/instance-hunt.ts";
import type { WorldService } from "../modules/world/domain/world-service.ts";
import type { PresenceService } from "../modules/world/application/presence-service.ts";
import { JuggerWireModule } from "../modules/jugger-wire/jugger-wire-module.ts";
import type { EsrvOutbox } from "../modules/jugger-wire/application/esrv-outbox.ts";
import type { HuntAreaFanout } from "../modules/jugger-wire/application/hunt-area-fanout.ts";
import type { LongPollCoordinator } from "../modules/jugger-wire/application/long-poll-coordinator.ts";
import type { PartySnapshot } from "../modules/jugger-wire/application/party-snapshot.ts";
import type { PresenceFanout } from "../modules/jugger-wire/application/presence-fanout.ts";
import type { TradeModule } from "../modules/trade/trade-module.ts";
import type { PostgresDatabase } from "../infrastructure/postgres/database.ts";
import type { Clock } from "../shared/kernel/clock.ts";
import type { DelayScheduler } from "../shared/kernel/delay-scheduler.ts";
import type { AppConfig } from "./config.ts";
import type { AuctionBid } from "./auction-bid.ts";
import type { AuctionBoard } from "./auction-board.ts";
import type { AuctionBuyout } from "./auction-buyout.ts";
import type { AuctionCancel } from "./auction-cancel.ts";
import type { AuctionList } from "./auction-list.ts";
import type { AuctionTenderAdd } from "./auction-tender-add.ts";
import type { AuctionTenderCancel } from "./auction-tender-cancel.ts";
import type { AuctionTenderSell } from "./auction-tender-sell.ts";
import type { ChatDesk } from "./chat-desk.ts";
import type { InstanceDesk } from "./instance-desk.ts";
import type { MailClaim } from "./mail-claim.ts";
import type { MailSend } from "./mail-send.ts";
import type { PartyBagOps } from "./party-bag-ops.ts";
import type { PartyNotify } from "./party-notify.ts";
import type { PlayableAccountRegistration } from "./playable-account-registration.ts";
import type { PlayableDevelopmentIdentity } from "./playable-development-identity.ts";
import type { PvpFightHonorCache } from "./pvp-fight-honor-cache.ts";
import { StorePurchase } from "./store-purchase.ts";
import { StoreRepair } from "./store-repair.ts";
import { TradeDesk } from "./trade-desk.ts";
import type {
  JuggerWireBootstrapPolicy,
  JuggerWireFightPolicy,
} from "../modules/jugger-wire/jugger-wire-policy.ts";

export async function createJuggerRuntime(input: {
  config: AppConfig;
  identity: IdentityService;
  registration: PlayableAccountRegistration;
  developmentIdentity: PlayableDevelopmentIdentity;
  characters: CharacterService;
  inventory: InventoryService;
  catalog: Catalog;
  world: WorldService;
  combat: CombatPort;
  clock: Clock;
  bootstrap: JuggerWireBootstrapPolicy;
  fightWire: JuggerWireFightPolicy;
  meleeSourceIds: Readonly<{ left: number; center: number; right: number }>;
  database: PostgresDatabase;
  presence: PresenceService;
  presenceFanout: PresenceFanout;
  huntFanout: HuntAreaFanout;
  outbox: EsrvOutbox;
  longPoll: LongPollCoordinator;
  mail: MailService;
  mailSend: MailSend;
  mailClaim: MailClaim;
  auction: AuctionService;
  auctionBoard: AuctionBoard;
  auctionList: AuctionList;
  auctionBid: AuctionBid;
  auctionBuyout: AuctionBuyout;
  auctionCancel: AuctionCancel;
  auctionTenderAdd: AuctionTenderAdd;
  auctionTenderSell: AuctionTenderSell;
  auctionTenderCancel: AuctionTenderCancel;
  chat: ChatDesk;
  party: PartyService;
  partyJoin: PartyJoinService;
  partySnapshot: PartySnapshot;
  partyNotify: PartyNotify;
  partyBag: PartyBagOps;
  instanceHunt: InstanceHuntWorld;
  instanceDesk: InstanceDesk;
  dungeonHunt: DungeonHuntWorld;
  battlegrounds: BattlegroundCatalog;
  instances: InstanceService;
  bestiary: HeroBestiary;
  delay: DelayScheduler;
  professions: ProfessionsService;
  craft: CraftService;
  quests: QuestService;
  questCatalog: QuestCatalog;
  pvpHonor: PvpFightHonorCache;
  contentEditor: ContentEditor;
  ambushRandom: RandomSource;
  trade: TradeModule;
}): Promise<{ wire: JuggerWireModule }> {
  const wire = await JuggerWireModule.create({
    config: input.config,
    identity: input.identity,
    registration: input.registration,
    developmentIdentity: input.developmentIdentity,
    characters: input.characters,
    inventory: input.inventory,
    catalog: input.catalog,
    world: input.world,
    combat: input.combat,
    clock: input.clock,
    bootstrap: input.bootstrap,
    fightWire: input.fightWire,
    meleeSourceIds: input.meleeSourceIds,
    unitOfWork: input.database,
    presence: input.presence,
    presenceFanout: input.presenceFanout,
    huntFanout: input.huntFanout,
    outbox: input.outbox,
    longPoll: input.longPoll,
    storePurchase: new StorePurchase(
      input.database,
      input.characters,
      input.inventory,
      input.catalog,
      input.world,
    ),
    storeRepair: new StoreRepair(input.database, input.characters, input.inventory),
    mail: input.mail,
    mailSend: input.mailSend,
    mailClaim: input.mailClaim,
    auction: input.auction,
    auctionBoard: input.auctionBoard,
    auctionList: input.auctionList,
    auctionBid: input.auctionBid,
    auctionBuyout: input.auctionBuyout,
    auctionCancel: input.auctionCancel,
    auctionTenderAdd: input.auctionTenderAdd,
    auctionTenderSell: input.auctionTenderSell,
    auctionTenderCancel: input.auctionTenderCancel,
    trade: new TradeDesk({
      sessions: input.trade.sessions,
      heldItems: input.trade.heldItems,
      unitOfWork: input.database,
      characters: input.characters,
      inventory: input.inventory,
      catalog: input.catalog,
      presence: input.identity,
    }),
    chat: input.chat,
    party: input.party,
    partyJoin: input.partyJoin,
    partySnapshot: input.partySnapshot,
    partyNotify: input.partyNotify,
    partyBag: input.partyBag,
    instanceHunt: input.instanceHunt,
    instanceDesk: input.instanceDesk,
    dungeonHunt: input.dungeonHunt,
    battlegrounds: input.battlegrounds,
    instances: input.instances,
    bestiary: input.bestiary,
    database: input.database,
    delay: input.delay,
    professions: input.professions,
    craft: input.craft,
    quests: input.quests,
    questCatalog: input.questCatalog,
    pvpHonor: input.pvpHonor,
    contentEditor: input.contentEditor,
    ambushRandom: input.ambushRandom,
  });
  return { wire };
}
