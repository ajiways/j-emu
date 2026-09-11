import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../character/application/character-service.ts";
import type { CombatPort } from "../../combat/ports/combat-port.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";
import type { WorldService } from "../../world/domain/world-service.ts";
import type { Clock } from "../../../shared/kernel/clock.ts";
import type { UnitOfWork } from "../../../shared/kernel/unit-of-work.ts";
import type { BootstrapReadModel } from "../application/bootstrap-read-model.ts";
import type { HeroSheetReadModel } from "../application/hero-sheet-read-model.ts";
import type { FightWireMapper } from "../application/fight-wire-mapper.ts";
import type { StorePurchase } from "../../../app/store-purchase.ts";
import type { StoreRepair } from "../../../app/store-repair.ts";
import type { MailSend } from "../../../app/mail-send.ts";
import type { MailClaim } from "../../../app/mail-claim.ts";
import type { AuctionBoard } from "../../../app/auction-board.ts";
import type { AuctionList } from "../../../app/auction-list.ts";
import type { AuctionBid } from "../../../app/auction-bid.ts";
import type { AuctionBuyout } from "../../../app/auction-buyout.ts";
import type { AuctionCancel } from "../../../app/auction-cancel.ts";
import type { AuctionTenderAdd } from "../../../app/auction-tender-add.ts";
import type { AuctionTenderSell } from "../../../app/auction-tender-sell.ts";
import type { AuctionTenderCancel } from "../../../app/auction-tender-cancel.ts";
import type { TradeDesk } from "../../../app/trade-desk.ts";
import type { ChatDesk } from "../../../app/chat-desk.ts";
import { PartyDesk } from "../../../app/party-desk.ts";
import type { PartyBagOps } from "../../../app/party-bag-ops.ts";
import type { PartyNotify } from "../../../app/party-notify.ts";
import type { AuctionService } from "../../auction/application/auction-service.ts";
import type { MailService } from "../../mail/application/mail-service.ts";
import { AttackBotCommand } from "../commands/oa/attack-bot-command.ts";
import { BagDropCommand } from "../commands/oa/bag-drop-command.ts";
import { ChatAddCommand } from "../commands/oa/chat-add-command.ts";
import { ChatConfCommand } from "../commands/oa/chat-conf-command.ts";
import { CommonConfCommand } from "../commands/oa/common-conf-command.ts";
import { CommonInitCommand } from "../commands/oa/common-init-command.ts";
import { CommonInit2Command } from "../commands/oa/common-init2-command.ts";
import { CommonMenuLinkStatusCommand } from "../commands/oa/common-menu-link-status-command.ts";
import { EmptyCollectionOaCommand } from "../commands/oa/empty-collection-oa-command.ts";
import { PutOffCommand } from "../commands/oa/put-off-command.ts";
import { PutOnCommand } from "../commands/oa/put-on-command.ts";
import { ComeInCommand } from "../commands/oa/come-in-command.ts";
import { CommonExitCommand } from "../commands/oa/common-exit-command.ts";
import { ResurrectCommand } from "../commands/oa/resurrect-command.ts";
import { StoreBuyCommand } from "../commands/oa/store-buy-command.ts";
import { StoreListCommand } from "../commands/oa/store-list-command.ts";
import { StoreRepairCommand } from "../commands/oa/store-repair-command.ts";
import { PostDeleteCommand } from "../commands/oa/post-delete-command.ts";
import { PostListCommand } from "../commands/oa/post-list-command.ts";
import { PostListSentCommand } from "../commands/oa/post-list-sent-command.ts";
import { PostReadCommand } from "../commands/oa/post-read-command.ts";
import { FightJoinCommand } from "../commands/oa/fight-join-command.ts";
import { PostSendCommand } from "../commands/oa/post-send-command.ts";
import { PostSendCodCommand } from "../commands/oa/post-send-cod-command.ts";
import { PostPickCommand } from "../commands/oa/post-pick-command.ts";
import { PostBatchPickCommand } from "../commands/oa/post-batch-pick-command.ts";
import { PostRetractCommand } from "../commands/oa/post-retract-command.ts";
import { UseArtifactCommand } from "../commands/oa/use-artifact-command.ts";
import { UpgradeCommand } from "../commands/oa/upgrade-command.ts";
import { UserBagCommand } from "../commands/oa/user-bag-command.ts";
import { UserBagOrderCommand } from "../commands/oa/user-bag-order-command.ts";
import { UserFlashMessageCommand } from "../commands/oa/user-flash-message-command.ts";
import { FriendlyDuelAcceptCommand } from "../commands/oa/friendly-duel-accept-command.ts";
import { FriendlyDuelProposeCommand } from "../commands/oa/friendly-duel-propose-command.ts";
import { UserMagicCommand } from "../commands/oa/user-magic-command.ts";
import { UserPersonalDetailsCommand } from "../commands/oa/user-personal-details-command.ts";
import { UserSavePersonalDetailsCommand } from "../commands/oa/user-save-personal-details-command.ts";
import { UserSkillsCommand } from "../commands/oa/user-skills-command.ts";
import { UserStatsCommand } from "../commands/oa/user-stats-command.ts";
import { UserProfessionsCommand } from "../commands/oa/user-professions-command.ts";
import { UserUnitframeCommand } from "../commands/oa/user-unitframe-command.ts";
import { UserViewCommand } from "../commands/oa/user-view-command.ts";
import { EsrvCommandRegistry } from "./esrv-command-registry.ts";
import { FproxyCommandRegistry } from "./fproxy-command-registry.ts";
import { OaCommandRegistry } from "./oa-command-registry.ts";
import type { PresenceFanout } from "../application/presence-fanout.ts";
import type { HuntAreaFanout } from "../application/hunt-area-fanout.ts";
import type { SessionPresence } from "../../identity/ports/session-presence.ts";
import type { EsrvOutbox } from "../application/esrv-outbox.ts";
import { AcceptFriendlyDuel } from "../application/accept-friendly-duel.ts";
import { FriendlyDuelInvites } from "../application/friendly-duel-invites.ts";
import { ProposeFriendlyDuel } from "../application/propose-friendly-duel.ts";
import { TradeMutation } from "../application/trade-mutation.ts";
import type { PartyJoinService } from "../../party/application/party-join-service.ts";
import type { PartyService } from "../../party/application/party-service.ts";
import type { PartySnapshot } from "../application/party-snapshot.ts";
import type { InstanceDesk } from "../../../app/instance-desk.ts";
import type { DungeonHuntWorld } from "../../instance/application/dungeon-hunt-world.ts";
import type { BattlegroundDesk } from "../../../app/battleground-desk.ts";
import type { BookDesk } from "../../../app/book-desk.ts";
import { AttackNickCommand } from "../commands/oa/attack-nick-command.ts";
import { AssistantDesk } from "../../../app/assistant-desk.ts";
import { CraftDesk } from "../../../app/craft-desk.ts";
import { deskOaCommands } from "./desk-oa-commands.ts";
import { marketOaCommands } from "./market-oa-commands.ts";
import type { ProfessionsService } from "../../professions/application/professions-service.ts";
import type { CraftService } from "../../professions/application/craft-service.ts";
import type { QuestService } from "../../quests/application/quest-service.ts";
import { QuestDesk } from "../../../app/quest-desk.ts";
export class JuggerCommandModule {
  readonly oa: OaCommandRegistry;
  readonly fproxy: FproxyCommandRegistry;
  readonly esrv: EsrvCommandRegistry;
  readonly fightWire: FightWireMapper;
  readonly quests: QuestDesk;

  constructor(
    bootstrap: BootstrapReadModel,
    sheet: HeroSheetReadModel,
    characters: CharacterService,
    inventory: InventoryService,
    world: WorldService,
    catalog: Catalog,
    combat: CombatPort,
    fightWire: FightWireMapper,
    meleeSourceIds: Readonly<{ left: number; center: number; right: number }>,
    unitOfWork: UnitOfWork,
    clock: Clock,
    presence: PresenceFanout,
    huntFanout: HuntAreaFanout,
    storePurchase: StorePurchase,
    storeRepair: StoreRepair,
    mail: MailService,
    mailSend: MailSend,
    mailClaim: MailClaim,
    auction: AuctionService,
    auctionBoard: AuctionBoard,
    auctionList: AuctionList,
    auctionBid: AuctionBid,
    auctionBuyout: AuctionBuyout,
    auctionCancel: AuctionCancel,
    auctionTenderAdd: AuctionTenderAdd,
    auctionTenderSell: AuctionTenderSell,
    auctionTenderCancel: AuctionTenderCancel,
    trade: TradeDesk,
    chat: ChatDesk,
    sessions: SessionPresence,
    outbox: EsrvOutbox,
    wake: Readonly<{ wake(accountId: number): void }>,
    party: PartyService,
    partyJoin: PartyJoinService,
    partySnapshot: PartySnapshot,
    partyNotify: PartyNotify,
    partyBag: PartyBagOps,
    instanceDesk: InstanceDesk,
    dungeonHunt: DungeonHuntWorld,
    battleground: BattlegroundDesk,
    book: BookDesk,
    professions: ProfessionsService,
    craft: CraftService,
    quests: QuestService,
  ) {
    this.fightWire = fightWire;
    this.quests = new QuestDesk(
      quests,
      characters,
      inventory,
      catalog,
      world,
      combat,
      chat,
      unitOfWork,
      fightWire,
      bootstrap,
    );
    const invites = new FriendlyDuelInvites(clock);
    const propose = new ProposeFriendlyDuel(
      characters,
      sessions,
      combat,
      catalog,
      invites,
      outbox,
      wake,
      clock,
    );
    const accept = new AcceptFriendlyDuel(
      unitOfWork,
      characters,
      sessions,
      combat,
      catalog,
      inventory,
      world,
      invites,
      outbox,
      wake,
      fightWire,
      bootstrap,
    );
    const tradeMutation = new TradeMutation(
      trade,
      chat,
      bootstrap,
      characters,
      inventory,
      catalog,
      outbox,
      wake,
    );
    const partyDesk = new PartyDesk({
      parties: party,
      join: partyJoin,
      snapshot: partySnapshot,
      notify: partyNotify,
      bags: partyBag,
      characters,
      sessions,
      bootstrap,
      unitOfWork,
    });
    this.oa = new OaCommandRegistry([
      new CommonInitCommand(unitOfWork, characters, bootstrap, battleground),
      new CommonInit2Command(unitOfWork, characters, bootstrap, battleground),
      new CommonConfCommand(bootstrap),
      new CommonMenuLinkStatusCommand(sheet),
      new UserBagCommand(bootstrap),
      new UserPersonalDetailsCommand(bootstrap),
      new UserSavePersonalDetailsCommand(characters, bootstrap),
      new UserSkillsCommand(bootstrap),
      new UserStatsCommand(characters, catalog, professions),
      new UserProfessionsCommand(characters),
      new UserUnitframeCommand(unitOfWork, characters, bootstrap),
      new UserViewCommand(bootstrap),
      new UserMagicCommand(bootstrap, sheet),
      new UserFlashMessageCommand(bootstrap),
      new FriendlyDuelProposeCommand(propose),
      new FriendlyDuelAcceptCommand(accept),
      new ChatConfCommand(bootstrap, sheet),
      new ChatAddCommand(chat, bootstrap),
      new EmptyCollectionOaCommand("companion|list_user_companions", "companions", bootstrap),
      new EmptyCollectionOaCommand("battlepass|list", "list", bootstrap),
      new EmptyCollectionOaCommand("jail|list", "punishments", bootstrap),
      new AttackBotCommand(
        unitOfWork,
        bootstrap,
        characters,
        inventory,
        world,
        catalog,
        combat,
        fightWire,
        huntFanout,
        chat,
        party,
        partyNotify,
        dungeonHunt,
      ),
      new PutOnCommand(unitOfWork, bootstrap, characters, inventory, catalog, combat, this.quests),
      new PutOffCommand(unitOfWork, bootstrap, characters, inventory, catalog, combat),
      new BagDropCommand(
        "common|object:DROP",
        "drop",
        unitOfWork,
        bootstrap,
        characters,
        inventory,
        combat,
      ),
      new BagDropCommand(
        "common|object:SELL",
        "sell",
        unitOfWork,
        bootstrap,
        characters,
        inventory,
        combat,
      ),
      new UseArtifactCommand(
        unitOfWork,
        bootstrap,
        characters,
        inventory,
        combat,
        clock,
        craft,
        this.quests,
      ),
      new UpgradeCommand(unitOfWork, bootstrap, characters, inventory, combat),
      new ComeInCommand(
        unitOfWork,
        bootstrap,
        characters,
        inventory,
        world,
        combat,
        clock,
        presence,
        instanceDesk,
      ),
      new CommonExitCommand(
        unitOfWork,
        bootstrap,
        characters,
        inventory,
        world,
        combat,
        clock,
        presence,
        instanceDesk,
      ),
      new ResurrectCommand(bootstrap, characters, combat, instanceDesk),
      new StoreListCommand(characters, catalog),
      new StoreBuyCommand(bootstrap, characters, storePurchase, this.quests),
      new StoreRepairCommand(bootstrap, sheet, characters, storeRepair),
      new PostListCommand(characters, mail, catalog),
      new PostListSentCommand(characters, mail, catalog),
      new PostSendCommand(bootstrap, characters, mailSend),
      new PostSendCodCommand(bootstrap, characters, mailSend),
      new PostPickCommand(bootstrap, characters, mail, mailClaim, catalog),
      new PostBatchPickCommand(bootstrap, characters, mail, mailClaim, catalog),
      new PostDeleteCommand(bootstrap, characters, mail, catalog),
      new PostRetractCommand(bootstrap, characters, mail, mailClaim, catalog),
      new PostReadCommand(),
      new UserBagOrderCommand(bootstrap),
      ...marketOaCommands({
        characters,
        inventory,
        catalog,
        bootstrap,
        auction,
        auctionBoard,
        auctionList,
        auctionBid,
        auctionBuyout,
        auctionCancel,
        auctionTenderAdd,
        auctionTenderSell,
        auctionTenderCancel,
        trade: tradeMutation,
      }),
      new FightJoinCommand(
        "common|object:FIGHT_JOIN",
        unitOfWork,
        bootstrap,
        characters,
        inventory,
        catalog,
        combat,
        fightWire,
        huntFanout,
      ),
      new FightJoinCommand(
        "common|object:FIGHT_HELP",
        unitOfWork,
        bootstrap,
        characters,
        inventory,
        catalog,
        combat,
        fightWire,
        huntFanout,
      ),
      ...deskOaCommands({
        party: partyDesk,
        battleground,
        book,
        assistants: new AssistantDesk(professions, characters),
        craft: new CraftDesk(craft, characters, inventory, catalog),
        quests: this.quests,
      }),
      new AttackNickCommand(battleground),
    ]);
    this.fproxy = FproxyCommandRegistry.fromMeleeSourceIds(meleeSourceIds);
    this.esrv = EsrvCommandRegistry.create(combat, fightWire);
  }
}
