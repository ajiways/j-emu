import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../character/application/character-service.ts";
import type { CombatPort } from "../../combat/ports/combat-port.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";
import type { WorldService } from "../../world/domain/world-service.ts";
import type { BootstrapReadModel } from "../application/bootstrap-read-model.ts";
import type { FightWireMapper } from "../application/fight-wire-mapper.ts";
import { AttackBotCommand } from "../commands/oa/attack-bot-command.ts";
import { CommonInitCommand } from "../commands/oa/common-init-command.ts";
import { CommonInit2Command } from "../commands/oa/common-init2-command.ts";
import { UserBagCommand } from "../commands/oa/user-bag-command.ts";
import { EsrvCommandRegistry } from "./esrv-command-registry.ts";
import { FproxyCommandRegistry } from "./fproxy-command-registry.ts";
import { OaCommandRegistry } from "./oa-command-registry.ts";

export class JuggerCommandModule {
  readonly oa: OaCommandRegistry;
  readonly fproxy: FproxyCommandRegistry;
  readonly esrv: EsrvCommandRegistry;
  readonly fightWire: FightWireMapper;

  constructor(
    bootstrap: BootstrapReadModel,
    characters: CharacterService,
    inventory: InventoryService,
    world: WorldService,
    catalog: Catalog,
    combat: CombatPort,
    fightWire: FightWireMapper,
    meleeSourceIds: Readonly<{ left: number; center: number; right: number }>,
  ) {
    this.fightWire = fightWire;
    this.oa = new OaCommandRegistry([
      new CommonInitCommand(bootstrap),
      new CommonInit2Command(bootstrap),
      new UserBagCommand(bootstrap),
      new AttackBotCommand(bootstrap, characters, inventory, world, catalog, combat, fightWire),
    ]);
    this.fproxy = FproxyCommandRegistry.fromMeleeSourceIds(meleeSourceIds);
    this.esrv = EsrvCommandRegistry.create(combat, fightWire);
  }
}
