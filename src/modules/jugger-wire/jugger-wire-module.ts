import type { StorePurchase } from "../../app/store-purchase.ts";
import type { StoreRepair } from "../../app/store-repair.ts";
import type { MailSend } from "../../app/mail-send.ts";
import type { MailClaim } from "../../app/mail-claim.ts";
import type { AuctionBoard } from "../../app/auction-board.ts";
import type { AuctionList } from "../../app/auction-list.ts";
import type { AuctionBid } from "../../app/auction-bid.ts";
import type { AuctionBuyout } from "../../app/auction-buyout.ts";
import type { AuctionCancel } from "../../app/auction-cancel.ts";
import type { AuctionTenderAdd } from "../../app/auction-tender-add.ts";
import type { AuctionTenderSell } from "../../app/auction-tender-sell.ts";
import type { AuctionTenderCancel } from "../../app/auction-tender-cancel.ts";
import type { TradeDesk } from "../../app/trade-desk.ts";
import type { ChatDesk } from "../../app/chat-desk.ts";
import type { PartyNotify } from "../../app/party-notify.ts";
import type { PartyBagOps } from "../../app/party-bag-ops.ts";
import type { AuctionService } from "../auction/application/auction-service.ts";
import type { MailService } from "../mail/application/mail-service.ts";
import type { PartyJoinService } from "../party/application/party-join-service.ts";
import type { PartyService } from "../party/application/party-service.ts";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../../app/config.ts";
import type { PlayableAccountRegistration } from "../../app/playable-account-registration.ts";
import type { PlayableDevelopmentIdentity } from "../../app/playable-development-identity.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import type { Clock } from "../../shared/kernel/clock.ts";
import type { UnitOfWork } from "../../shared/kernel/unit-of-work.ts";
import type { Catalog } from "../catalog/ports/catalog.ts";
import type { CharacterService } from "../character/application/character-service.ts";
import type { CombatPort } from "../combat/ports/combat-port.ts";
import type { IdentityService } from "../identity/application/identity-service.ts";
import type { InventoryService } from "../inventory/domain/inventory-service.ts";
import type { WorldService } from "../world/domain/world-service.ts";
import type { PresenceService } from "../world/application/presence-service.ts";
import { BootstrapReadModel } from "./application/bootstrap-read-model.ts";
import { HeroSheetReadModel } from "./application/hero-sheet-read-model.ts";
import type { ChatConfPolicy } from "./application/chat-conf-block.ts";
import { EsrvPollAssembler } from "./application/esrv-poll-assembler.ts";
import { FightWireMapper } from "./application/fight-wire-mapper.ts";
import type { EsrvOutbox } from "./application/esrv-outbox.ts";
import type { LongPollCoordinator } from "./application/long-poll-coordinator.ts";
import type { PresenceFanout } from "./application/presence-fanout.ts";
import type { HuntAreaFanout } from "./application/hunt-area-fanout.ts";
import { JuggerHttpServer } from "./infrastructure/http/jugger-http-server.ts";
import { FightTcpServer } from "./infrastructure/tcp/fight-tcp-server.ts";
import { JuggerCommandModule } from "./registry/jugger-command-module.ts";
import type { PartySnapshot } from "./application/party-snapshot.ts";
import type { InstanceDesk } from "../../app/instance-desk.ts";
import type { InstanceHuntWorld } from "../instance/ports/instance-hunt.ts";
import type { DungeonHuntWorld } from "../instance/application/dungeon-hunt-world.ts";

export type JuggerWireBootstrapPolicy = Readonly<{
  bagCapacity: number;
  pocketCapacity: number;
  chat: ChatConfPolicy;
  menuLinks: Readonly<Record<string, string>>;
}>;

export type JuggerWireFightPolicy = Readonly<{
  heroSkill: number;
  heroBody: string;
  autoFight: number;
  canLeave: 0 | 1;
  companionEnabled: 0 | 1;
  isPvp: 0 | 1;
  instanceId: string;
  type: string;
  isSlaughter: boolean;
  flags: string;
}>;

export class JuggerWireModule {
  private constructor(
    readonly http: FastifyInstance,
    private readonly longPoll: LongPollCoordinator,
    private readonly fightTcp: FightTcpServer,
  ) {}

  static async create(input: {
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
    unitOfWork: UnitOfWork;
    presence: PresenceService;
    presenceFanout: PresenceFanout;
    huntFanout: HuntAreaFanout;
    outbox: EsrvOutbox;
    longPoll: LongPollCoordinator;
    storePurchase: StorePurchase;
    storeRepair: StoreRepair;
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
    trade: TradeDesk;
    chat: ChatDesk;
    party: PartyService;
    partyJoin: PartyJoinService;
    partySnapshot: PartySnapshot;
    partyNotify: PartyNotify;
    partyBag: PartyBagOps;
    instanceHunt: InstanceHuntWorld;
    instanceDesk: InstanceDesk;
    dungeonHunt: DungeonHuntWorld;
  }): Promise<JuggerWireModule> {
    const config = requirePresent(input.config, "Jugger-wire module requires config");
    const identity = requirePresent(input.identity, "Jugger-wire module requires identity");
    const registration = requirePresent(
      input.registration,
      "Jugger-wire module requires playable registration",
    );
    const developmentIdentity = requirePresent(
      input.developmentIdentity,
      "Jugger-wire module requires development identity",
    );
    const characters = requirePresent(input.characters, "Jugger-wire module requires characters");
    const inventory = requirePresent(input.inventory, "Jugger-wire module requires inventory");
    const catalog = requirePresent(input.catalog, "Jugger-wire module requires catalog");
    const world = requirePresent(input.world, "Jugger-wire module requires world");
    const combat = requirePresent(input.combat, "Jugger-wire module requires combat");
    const clock = requirePresent(input.clock, "Jugger-wire module requires clock");
    const bootstrapPolicy = requirePresent(
      input.bootstrap,
      "Jugger-wire module requires bootstrap policy",
    );
    const fightWirePolicy = requirePresent(
      input.fightWire,
      "Jugger-wire module requires fight wire policy",
    );
    const meleeSourceIds = requirePresent(
      input.meleeSourceIds,
      "Jugger-wire module requires melee source ids",
    );
    const unitOfWork = requirePresent(
      input.unitOfWork,
      "Jugger-wire module requires a unit of work",
    );
    const presence = requirePresent(input.presence, "Jugger-wire module requires presence");
    const presenceFanout = requirePresent(
      input.presenceFanout,
      "Jugger-wire module requires presence fanout",
    );
    const huntFanout = requirePresent(input.huntFanout, "Jugger-wire module requires hunt fanout");
    const outbox = requirePresent(input.outbox, "Jugger-wire module requires esrv outbox");
    const longPoll = requirePresent(input.longPoll, "Jugger-wire module requires long-poll");
    const storePurchase = requirePresent(
      input.storePurchase,
      "Jugger-wire module requires store purchase",
    );
    const storeRepair = requirePresent(
      input.storeRepair,
      "Jugger-wire module requires store repair",
    );
    const mail = requirePresent(input.mail, "Jugger-wire module requires mail");
    const mailSend = requirePresent(input.mailSend, "Jugger-wire module requires mail send");
    const mailClaim = requirePresent(input.mailClaim, "Jugger-wire module requires mail claim");
    const auction = requirePresent(input.auction, "Jugger-wire module requires auction");
    const auctionBoard = requirePresent(
      input.auctionBoard,
      "Jugger-wire module requires auction board",
    );
    const auctionList = requirePresent(
      input.auctionList,
      "Jugger-wire module requires auction list",
    );
    const auctionBid = requirePresent(input.auctionBid, "Jugger-wire module requires auction bid");
    const auctionBuyout = requirePresent(
      input.auctionBuyout,
      "Jugger-wire module requires auction buyout",
    );
    const auctionCancel = requirePresent(
      input.auctionCancel,
      "Jugger-wire module requires auction cancel",
    );
    const auctionTenderAdd = requirePresent(
      input.auctionTenderAdd,
      "Jugger-wire module requires auction tender add",
    );
    const auctionTenderSell = requirePresent(
      input.auctionTenderSell,
      "Jugger-wire module requires auction tender sell",
    );
    const auctionTenderCancel = requirePresent(
      input.auctionTenderCancel,
      "Jugger-wire module requires auction tender cancel",
    );
    const trade = requirePresent(input.trade, "Jugger-wire module requires trade desk");
    const chat = requirePresent(input.chat, "Jugger-wire module requires chat desk");
    const party = requirePresent(input.party, "Jugger-wire module requires party");
    const partyJoin = requirePresent(input.partyJoin, "Jugger-wire module requires party join");
    const partySnapshot = requirePresent(
      input.partySnapshot,
      "Jugger-wire module requires party snapshot",
    );
    const partyNotify = requirePresent(
      input.partyNotify,
      "Jugger-wire module requires party notify",
    );
    const partyBag = requirePresent(input.partyBag, "Jugger-wire module requires party bag ops");
    const instanceHunt = requirePresent(
      input.instanceHunt,
      "Jugger-wire module requires instance hunt",
    );
    const instanceDesk = requirePresent(
      input.instanceDesk,
      "Jugger-wire module requires instance desk",
    );
    const dungeonHunt = requirePresent(
      input.dungeonHunt,
      "Jugger-wire module requires dungeon hunt",
    );
    try {
      const fightWire = new FightWireMapper(
        {
          host: config.fightProxyHost,
          port: config.fightProxyPort,
          proxyPath: config.fightProxyPath,
        },
        fightWirePolicy,
      );
      const commands = new JuggerCommandModule(
        new BootstrapReadModel(
          characters,
          inventory,
          catalog,
          world,
          combat,
          clock,
          presence,
          fightWire,
          mail,
          party,
          partySnapshot,
          instanceHunt,
          bootstrapPolicy,
        ),
        new HeroSheetReadModel({
          chat: bootstrapPolicy.chat,
          menuLinks: bootstrapPolicy.menuLinks,
        }),
        characters,
        inventory,
        world,
        catalog,
        combat,
        fightWire,
        meleeSourceIds,
        unitOfWork,
        clock,
        presenceFanout,
        huntFanout,
        storePurchase,
        storeRepair,
        mail,
        mailSend,
        mailClaim,
        auction,
        auctionBoard,
        auctionList,
        auctionBid,
        auctionBuyout,
        auctionCancel,
        auctionTenderAdd,
        auctionTenderSell,
        auctionTenderCancel,
        trade,
        chat,
        identity,
        outbox,
        longPoll,
        party,
        partyJoin,
        partySnapshot,
        partyNotify,
        partyBag,
        instanceDesk,
        dungeonHunt,
      );
      const esrvPoll = new EsrvPollAssembler(
        characters,
        world,
        catalog,
        combat,
        fightWire,
        outbox,
        clock,
        instanceHunt,
      );
      const http = await new JuggerHttpServer({
        config,
        identity,
        registration,
        developmentIdentity,
        characters,
        inventory,
        commands,
        combat,
        longPoll,
        esrvPoll,
        presence: presenceFanout,
        unitOfWork,
      }).build();
      const fightTcp = new FightTcpServer(combat, commands.fproxy, fightWire, longPoll, http.log);
      try {
        await fightTcp.listen(config.host, config.fightProxyPort);
      } catch (error) {
        await http.close();
        throw error;
      }
      return new JuggerWireModule(http, longPoll, fightTcp);
    } catch (error) {
      longPoll.shutdown();
      throw error;
    }
  }

  async close(): Promise<void> {
    this.longPoll.shutdown();
    await this.fightTcp.close();
    await this.http.close();
  }
}
