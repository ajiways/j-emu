import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../character/application/character-service.ts";
import type { CombatPort } from "../../combat/ports/combat-port.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";
import type { SessionPresence } from "../../identity/ports/session-presence.ts";
import type { WorldService } from "../../world/domain/world-service.ts";
import type { UnitOfWork } from "../../../shared/kernel/unit-of-work.ts";
import type { Hero } from "../../character/domain/hero.ts";
import { ProtocolError } from "./protocol-error.ts";
import type { BootstrapReadModel } from "./bootstrap-read-model.ts";
import type { EsrvOutbox } from "./esrv-outbox.ts";
import type { FightWireMapper } from "./fight-wire-mapper.ts";
import type { FriendlyDuelInvites } from "./friendly-duel-invites.ts";
import { huntHeroStatFields } from "../../combat/domain/combatant-fight-stats.ts";
import { HuntCombatLoadout } from "./hunt-combat-loadout.ts";
import { heroFightConfLook } from "./hero-fight-appearance.ts";

export type FriendlyDuelAcceptBlocks = Readonly<{
  "user|friendly_duel_accept": Readonly<{ status: 100 }>;
  "fight|conf": ReturnType<FightWireMapper["friendlyDuelConfiguration"]>;
  "user|unitframe": Awaited<ReturnType<BootstrapReadModel["unitframe"]>>;
  state: Awaited<ReturnType<BootstrapReadModel["state"]>>;
}>;

export class AcceptFriendlyDuel {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly characters: CharacterService,
    private readonly sessions: SessionPresence,
    private readonly combat: CombatPort,
    private readonly catalog: Catalog,
    private readonly inventory: InventoryService,
    private readonly world: WorldService,
    private readonly invites: FriendlyDuelInvites,
    private readonly outbox: EsrvOutbox,
    private readonly wake: Readonly<{ wake(accountId: number): void }>,
    private readonly fightWire: FightWireMapper,
    private readonly bootstrap: BootstrapReadModel,
  ) {}

  async execute(accountId: number, challengerNick: string): Promise<FriendlyDuelAcceptBlocks> {
    const acceptor = await this.characters.getByAccountId(accountId);
    if (!acceptor) throw new Error(`Hero for account ${accountId} is missing`);
    const invite = this.invites.take(accountId);
    if (!invite) throw new ProtocolError(203, "вызов устарел");
    const nick = challengerNick.trim();
    if (nick && invite.fromNick.toLowerCase() !== nick.toLowerCase()) {
      throw new ProtocolError(203, "вызов от другого игрока");
    }
    if (acceptor.ghost) throw new ProtocolError(203, "призрак не может драться");
    if ((await this.combat.activeFightId(accountId)) !== null) {
      throw new ProtocolError(203, "уже в бою");
    }
    const challenger = await this.characters.getByAccountId(invite.fromAccountId);
    if (!challenger) throw new ProtocolError(203, "игрок не найден");
    const online = new Set(await this.sessions.listAccountIdsWithSession());
    if (!online.has(challenger.accountId)) throw new ProtocolError(203, "игрок не в сети");
    if ((await this.combat.activeFightId(challenger.accountId)) !== null) {
      throw new ProtocolError(203, "противник уже в бою");
    }
    if (challenger.areaId !== acceptor.areaId) {
      throw new ProtocolError(203, "игрок в другой локации");
    }
    const area = await this.world.area(acceptor.areaId);
    const fightId = await this.combat.nextFightId();
    const [challengerStart, acceptorStart] = await Promise.all([
      this.fighterInput(challenger),
      this.fighterInput(acceptor),
    ]);
    const started = await this.combat.startFriendlyDuel({
      fightId,
      arena: area.fightBackground,
      areaId: area.id,
      instanceCopyId: null,
      fightFlags: null,
      challenger: challengerStart,
      acceptor: acceptorStart,
    });
    const acceptorConf = this.fightWire.friendlyDuelConfiguration(
      started,
      heroFightConfLook(acceptor),
    );
    const challengerConf = this.fightWire.friendlyDuelConfiguration(
      {
        ...started,
        participantId: challenger.id,
      },
      heroFightConfLook(challenger),
    );
    this.outbox.enqueue(challenger.accountId, {
      "fight|conf": challengerConf,
      "user|unitframe": await this.bootstrap.unitframe(challenger.accountId),
      state: await this.bootstrap.state(challenger.accountId),
    });
    this.wake.wake(challenger.accountId);
    return {
      "user|friendly_duel_accept": { status: 100 },
      "fight|conf": acceptorConf,
      "user|unitframe": await this.bootstrap.unitframe(accountId),
      state: await this.bootstrap.state(accountId),
    };
  }

  private async fighterInput(hero: Hero) {
    await this.inventory.ensureStarterInventory(hero.id);
    const locked = await this.unitOfWork.run(async () => {
      const current = await this.characters.lockByAccountId(hero.accountId);
      await this.characters.syncResources({ characterId: current.id });
      const next = await this.characters.getByAccountId(hero.accountId);
      if (!next) throw new Error(`Hero for account ${hero.accountId} is missing`);
      return next;
    });
    const appearance = await this.catalog.appearance(locked.kind, locked.gender);
    const loadout = await new HuntCombatLoadout(this.inventory, this.catalog).snapshot(locked.id);
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
      ...huntHeroStatFields(await this.characters.combatFightStats(locked.id)),
      loadout,
      avatar: appearance.avatarSmall,
      body: locked.body,
      sk: String(locked.sk),
    };
  }
}
