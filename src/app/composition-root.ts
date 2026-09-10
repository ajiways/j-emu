import { PostgresDatabase } from "../infrastructure/postgres/database.ts";
import { CatalogModule } from "../modules/catalog/catalog-module.ts";
import { CharacterModule } from "../modules/character/character-module.ts";
import { CombatModule } from "../modules/combat/combat-module.ts";
import type { CombatDelay } from "../modules/combat/ports/combat-delay.ts";
import type { BattleRules } from "../modules/combat/domain/battle-rules.ts";
import { SystemCombatDelay } from "../modules/combat/infrastructure/system-combat-delay.ts";
import { IdentityModule } from "../modules/identity/identity-module.ts";
import { InventoryModule } from "../modules/inventory/inventory-module.ts";
import { JuggerWireModule } from "../modules/jugger-wire/jugger-wire-module.ts";
import { WorldModule } from "../modules/world/world-module.ts";
import { PostgresHeroRepository } from "../modules/character/infrastructure/postgres-hero-repository.ts";
import type { Clock } from "../shared/kernel/clock.ts";
import { SystemClock } from "../shared/kernel/system-clock.ts";
import { AccountKeyedActiveFightQuery } from "./account-keyed-active-fight-query.ts";
import { Application } from "./application.ts";
import type { AppConfig } from "./config.ts";
import { loadGamePolicy } from "./game-policy.ts";
import { PlayableAccountRegistration } from "./playable-account-registration.ts";
import { PlayableDevelopmentIdentity } from "./playable-development-identity.ts";
import { PresenceService } from "../modules/world/application/presence-service.ts";
import { EsrvOutbox } from "../modules/jugger-wire/application/esrv-outbox.ts";
import { LongPollCoordinator } from "../modules/jugger-wire/application/long-poll-coordinator.ts";
import { PresenceFanout } from "../modules/jugger-wire/application/presence-fanout.ts";
import { HuntAreaFanout } from "../modules/jugger-wire/application/hunt-area-fanout.ts";
import { HuntLockRelease } from "./hunt-lock-release.ts";
import { HuntFightSettlement } from "./hunt-fight-settlement.ts";
import { StorePurchase } from "./store-purchase.ts";
import { StoreRepair } from "./store-repair.ts";
import { MailSend } from "./mail-send.ts";
import { MailClaim } from "./mail-claim.ts";
import { MailTtlSweep } from "./mail-ttl-sweep.ts";
import { MailModule } from "../modules/mail/mail-module.ts";
import { AuctionModule } from "../modules/auction/auction-module.ts";
import { AuctionExpiry } from "./auction-expiry.ts";
import { AuctionBoard } from "./auction-board.ts";
import { AuctionList } from "./auction-list.ts";
import { AuctionBid } from "./auction-bid.ts";
import { AuctionBuyout } from "./auction-buyout.ts";
import { AuctionCancel } from "./auction-cancel.ts";
import { AuctionTenderAdd } from "./auction-tender-add.ts";
import { AuctionTenderSell } from "./auction-tender-sell.ts";
import { AuctionTenderCancel } from "./auction-tender-cancel.ts";
import { AuctionTtlSweep } from "./auction-ttl-sweep.ts";
import { TradeDesk } from "./trade-desk.ts";
import { ChatDesk } from "./chat-desk.ts";
import { ChatFightSettlement } from "./chat-fight-settlement.ts";
import { PartyNotify } from "./party-notify.ts";
import { PartyBagOps } from "./party-bag-ops.ts";
import { PartyLootRouting } from "./party-loot-routing.ts";
import { PartyFightLootNotify } from "./party-fight-loot-notify.ts";
import { TradeModule } from "../modules/trade/trade-module.ts";
import { PartyModule } from "../modules/party/party-module.ts";
import { PartySnapshot } from "../modules/jugger-wire/application/party-snapshot.ts";
import { buildUserBag } from "../modules/jugger-wire/application/user-bag-block.ts";
import { SystemRandomSource } from "../modules/combat/domain/system-random-source.ts";
import type { RandomSource } from "../modules/combat/domain/random-source.ts";

export class CompositionRoot {
  async build(
    config: AppConfig,
    clock: Clock = new SystemClock(),
    delay: CombatDelay = new SystemCombatDelay(),
    extras: Readonly<{
      lootRandom?: RandomSource;
      combatRandom?: RandomSource;
      partyRandom?: RandomSource;
      upgradeRandom?: RandomSource;
      wanderRandom?: RandomSource;
      combatRules?: Partial<BattleRules>;
      combatBotStrength?: number;
    }> = {},
  ): Promise<Application> {
    const policy = loadGamePolicy(config.gamePolicyFile);
    const closers: Array<{ close(): Promise<void> }> = [];
    try {
      const database = new PostgresDatabase(config.databaseUrl);
      closers.push(database);
      const identity = IdentityModule.create({ database, clock });
      closers.push(identity);
      const catalog = await CatalogModule.create({ database });
      closers.push(catalog);
      const inventory = InventoryModule.create({
        database,
        starterItems: policy.starterItems,
        releaseArtifacts: catalog.releaseArtifacts,
        catalog: catalog.catalog,
        bagCapacity: policy.bootstrap.bagCapacity,
        pocketCapacity: policy.bootstrap.pocketCapacity,
        random: extras.upgradeRandom ?? new SystemRandomSource(),
      });
      closers.push(inventory);
      const world = await WorldModule.create({
        database,
        clock,
        delay,
        random: extras.wanderRandom ?? new SystemRandomSource(),
      });
      closers.push(world);
      const combat = CombatModule.create({
        database,
        rules: {
          strPerDamagePoint:
            extras.combatRules?.strPerDamagePoint ?? policy.combat.strPerDamagePoint,
          damageSpread: extras.combatRules?.damageSpread ?? policy.combat.damageSpread,
          turnTimeoutSeconds:
            extras.combatRules?.turnTimeoutSeconds ?? policy.combat.turnTimeoutSeconds,
          meleeBotCounterMs:
            extras.combatRules?.meleeBotCounterMs ?? policy.combat.meleeBotCounterMs,
          turnGrantDelayMs: extras.combatRules?.turnGrantDelayMs ?? policy.combat.turnGrantDelayMs,
        },
        clock,
        delay,
        ...(extras.combatRandom === undefined ? {} : { random: extras.combatRandom }),
        ...(extras.combatBotStrength === undefined
          ? {}
          : { testBotStrength: extras.combatBotStrength }),
      });
      combat.startHistoryCleanup();
      closers.push(combat);
      const characters = CharacterModule.create({
        database,
        creationPolicy: policy.heroCreation,
        progression: catalog.progression,
        reputationCatalog: catalog.catalog,
        equipmentModifiers: inventory.service,
        clock,
        regenPolicy: policy.regen,
        activeFight: new AccountKeyedActiveFightQuery(
          new PostgresHeroRepository(database),
          combat.combat,
        ),
      });
      closers.push(characters);
      const mail = MailModule.create({
        database,
        clock,
        heroes: characters.service,
      });
      closers.push(mail);
      const auction = AuctionModule.create({ database, clock });
      closers.push(auction);
      const auctionExpiry = new AuctionExpiry(
        database,
        auction.service,
        mail.service,
        characters.service,
      );
      const auctionBoard = new AuctionBoard(auctionExpiry, auction.service);
      const auctionList = new AuctionList(
        database,
        auctionExpiry,
        characters.service,
        inventory.service,
        catalog.catalog,
        auction.service,
      );
      const auctionBid = new AuctionBid(
        database,
        auctionExpiry,
        characters.service,
        mail.service,
        auction.service,
      );
      const auctionBuyout = new AuctionBuyout(
        database,
        auctionExpiry,
        characters.service,
        mail.service,
        auction.service,
      );
      const auctionCancel = new AuctionCancel(
        database,
        auctionExpiry,
        characters.service,
        mail.service,
        auction.service,
      );
      const auctionTenderAdd = new AuctionTenderAdd(
        database,
        auctionExpiry,
        characters.service,
        catalog.catalog,
        auction.service,
      );
      const auctionTenderSell = new AuctionTenderSell(
        database,
        auctionExpiry,
        characters.service,
        inventory.service,
        mail.service,
        auction.service,
      );
      const auctionTenderCancel = new AuctionTenderCancel(
        database,
        auctionExpiry,
        characters.service,
        mail.service,
        auction.service,
      );
      const presence = new PresenceService(
        world.service,
        identity.service,
        characters.service,
        catalog.catalog,
      );
      const longPoll = new LongPollCoordinator();
      const outbox = new EsrvOutbox();
      const party = PartyModule.create({ database, clock });
      closers.push(party);
      const chatDesk = new ChatDesk({
        characters: characters.service,
        world: world.service,
        catalog: catalog.catalog,
        combat: combat.combat,
        presence,
        clock,
        outbox,
        wake: longPoll,
        party: party.service,
      });
      const partySnapshot = new PartySnapshot(
        party.service,
        party.bag,
        characters.service,
        catalog.catalog,
      );
      const partyNotify = new PartyNotify({
        outbox,
        wake: longPoll,
        chat: chatDesk,
        clock,
        catalog: catalog.catalog,
        memberAccountIds: (partyId) => party.service.memberAccountIds(partyId),
      });
      const partyBagOps = new PartyBagOps({
        parties: party.service,
        bags: party.bag,
        snapshot: partySnapshot,
        notify: partyNotify,
        characters: characters.service,
        inventory: inventory.service,
        userBag: async (accountId) => {
          const hero = await characters.service.getByAccountId(accountId);
          if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
          return buildUserBag(hero, inventory.service, catalog.catalog);
        },
        unitOfWork: database,
        clock,
        random: extras.partyRandom ?? extras.lootRandom ?? new SystemRandomSource(),
        wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      });
      const presenceFanout = new PresenceFanout(presence, outbox, longPoll);
      const huntFanout = new HuntAreaFanout(presence, longPoll);
      combat.bindWake({ wake: (accountId) => longPoll.wake(accountId) });
      world.service.bindAreaWake(huntFanout);
      combat.bindTerminalObserver(new HuntLockRelease(world.service, huntFanout));
      combat.bindSettlement(
        new ChatFightSettlement(
          new HuntFightSettlement(
            database,
            catalog.catalog,
            characters.service,
            inventory.service,
            extras.lootRandom ?? new SystemRandomSource(),
            new PartyLootRouting(party.service),
            party.bag,
            new PartyFightLootNotify(
              party.bag,
              party.service,
              characters.service,
              catalog.catalog,
              partyNotify,
            ),
          ),
          chatDesk,
          {
            failed(fightId, error) {
              process.stderr.write(`fight-chat ${fightId}: ${error.message}\n`);
            },
          },
        ),
      );
      const registration = new PlayableAccountRegistration(
        identity.service,
        characters.service,
        inventory.service,
        database,
        presenceFanout,
      );
      const developmentIdentity = new PlayableDevelopmentIdentity(
        identity.service,
        characters.service,
        inventory.service,
        database,
        presenceFanout,
      );
      const mailSend = new MailSend(
        database,
        characters.service,
        mail.service,
        inventory.service,
        catalog.catalog,
      );
      const mailClaim = new MailClaim(
        database,
        characters.service,
        mail.service,
        inventory.service,
      );
      const mailSweep = new MailTtlSweep(mail.service, delay, clock);
      mailSweep.start();
      closers.push(mailSweep);
      const auctionSweep = new AuctionTtlSweep(auctionExpiry, delay, clock);
      auctionSweep.start();
      closers.push(auctionSweep);
      const trade = TradeModule.create();
      closers.push(trade);
      const tradeDesk = new TradeDesk({
        sessions: trade.sessions,
        unitOfWork: database,
        characters: characters.service,
        inventory: inventory.service,
        catalog: catalog.catalog,
        presence: identity.service,
      });
      const wire = await JuggerWireModule.create({
        config,
        identity: identity.service,
        registration,
        developmentIdentity,
        characters: characters.service,
        inventory: inventory.service,
        catalog: catalog.catalog,
        world: world.service,
        combat: combat.combat,
        clock,
        bootstrap: policy.bootstrap,
        fightWire: policy.fightWire,
        meleeSourceIds: policy.combat.meleeSourceIds,
        unitOfWork: database,
        presence,
        presenceFanout,
        huntFanout,
        outbox,
        longPoll,
        storePurchase: new StorePurchase(
          database,
          characters.service,
          inventory.service,
          catalog.catalog,
          world.service,
        ),
        storeRepair: new StoreRepair(database, characters.service, inventory.service),
        mail: mail.service,
        mailSend,
        mailClaim,
        auction: auction.service,
        auctionBoard,
        auctionList,
        auctionBid,
        auctionBuyout,
        auctionCancel,
        auctionTenderAdd,
        auctionTenderSell,
        auctionTenderCancel,
        trade: tradeDesk,
        chat: chatDesk,
        party: party.service,
        partyJoin: party.join,
        partySnapshot,
        partyNotify,
        partyBag: partyBagOps,
      });
      closers.push(wire);
      return new Application(
        wire.http,
        characters.service,
        characters.service,
        characters.service,
        characters.service,
        async () => {
          await closeAll(closers);
        },
      );
    } catch (error) {
      await closeAll(closers);
      throw error;
    }
  }
}

async function closeAll(closers: readonly { close(): Promise<void> }[]): Promise<void> {
  for (const closer of [...closers].reverse()) {
    await closer.close();
  }
}
