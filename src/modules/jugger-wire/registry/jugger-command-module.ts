import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../character/application/character-service.ts";
import type { CombatPort } from "../../combat/ports/combat-port.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";
import type { WorldService } from "../../world/domain/world-service.ts";
import type { BootstrapReadModel } from "../application/bootstrap-read-model.ts";
import type { HeroSheetReadModel } from "../application/hero-sheet-read-model.ts";
import type { FightWireMapper } from "../application/fight-wire-mapper.ts";
import { AttackBotCommand } from "../commands/oa/attack-bot-command.ts";
import { BookQuestListCommand } from "../commands/oa/book-quest-list-command.ts";
import { ChatConfCommand } from "../commands/oa/chat-conf-command.ts";
import { CommonConfCommand } from "../commands/oa/common-conf-command.ts";
import { CommonInitCommand } from "../commands/oa/common-init-command.ts";
import { CommonInit2Command } from "../commands/oa/common-init2-command.ts";
import { CommonMenuLinkStatusCommand } from "../commands/oa/common-menu-link-status-command.ts";
import { EmptyCollectionOaCommand } from "../commands/oa/empty-collection-oa-command.ts";
import { UserBagCommand } from "../commands/oa/user-bag-command.ts";
import { UserFlashMessageCommand } from "../commands/oa/user-flash-message-command.ts";
import { UserMagicCommand } from "../commands/oa/user-magic-command.ts";
import { UserPersonalDetailsCommand } from "../commands/oa/user-personal-details-command.ts";
import { UserSavePersonalDetailsCommand } from "../commands/oa/user-save-personal-details-command.ts";
import { UserUnitframeCommand } from "../commands/oa/user-unitframe-command.ts";
import { UserViewCommand } from "../commands/oa/user-view-command.ts";
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
    sheet: HeroSheetReadModel,
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
      new CommonConfCommand(bootstrap),
      new CommonMenuLinkStatusCommand(sheet),
      new UserBagCommand(bootstrap),
      new UserPersonalDetailsCommand(bootstrap),
      new UserSavePersonalDetailsCommand(characters, bootstrap),
      new UserUnitframeCommand(bootstrap),
      new UserViewCommand(bootstrap, sheet),
      new UserMagicCommand(bootstrap, sheet),
      new UserFlashMessageCommand(bootstrap),
      new ChatConfCommand(bootstrap, sheet),
      new BookQuestListCommand(bootstrap, sheet),
      new EmptyCollectionOaCommand("companion|list_user_companions", "companions", bootstrap),
      new EmptyCollectionOaCommand("craft|user_recipes_list", "recipes", bootstrap),
      new EmptyCollectionOaCommand("battlepass|list", "list", bootstrap),
      new EmptyCollectionOaCommand("jail|list", "punishments", bootstrap),
      new AttackBotCommand(bootstrap, characters, inventory, world, catalog, combat, fightWire),
    ]);
    this.fproxy = FproxyCommandRegistry.fromMeleeSourceIds(meleeSourceIds);
    this.esrv = EsrvCommandRegistry.create(combat, fightWire);
  }
}
