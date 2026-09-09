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
import { AttackBotCommand } from "../commands/oa/attack-bot-command.ts";
import { BagDropCommand } from "../commands/oa/bag-drop-command.ts";
import { BookQuestListCommand } from "../commands/oa/book-quest-list-command.ts";
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
import { UseArtifactCommand } from "../commands/oa/use-artifact-command.ts";
import { UpgradeCommand } from "../commands/oa/upgrade-command.ts";
import { UserBagCommand } from "../commands/oa/user-bag-command.ts";
import { UserFlashMessageCommand } from "../commands/oa/user-flash-message-command.ts";
import { UserMagicCommand } from "../commands/oa/user-magic-command.ts";
import { UserPersonalDetailsCommand } from "../commands/oa/user-personal-details-command.ts";
import { UserSavePersonalDetailsCommand } from "../commands/oa/user-save-personal-details-command.ts";
import { UserSkillsCommand } from "../commands/oa/user-skills-command.ts";
import { UserStatsCommand } from "../commands/oa/user-stats-command.ts";
import { UserUnitframeCommand } from "../commands/oa/user-unitframe-command.ts";
import { UserViewCommand } from "../commands/oa/user-view-command.ts";
import { EsrvCommandRegistry } from "./esrv-command-registry.ts";
import { FproxyCommandRegistry } from "./fproxy-command-registry.ts";
import { OaCommandRegistry } from "./oa-command-registry.ts";
import type { PresenceFanout } from "../application/presence-fanout.ts";
import type { HuntAreaFanout } from "../application/hunt-area-fanout.ts";

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
    unitOfWork: UnitOfWork,
    clock: Clock,
    presence: PresenceFanout,
    huntFanout: HuntAreaFanout,
    storePurchase: StorePurchase,
    storeRepair: StoreRepair,
  ) {
    this.fightWire = fightWire;
    this.oa = new OaCommandRegistry([
      new CommonInitCommand(unitOfWork, characters, bootstrap),
      new CommonInit2Command(unitOfWork, characters, bootstrap),
      new CommonConfCommand(bootstrap),
      new CommonMenuLinkStatusCommand(sheet),
      new UserBagCommand(bootstrap),
      new UserPersonalDetailsCommand(bootstrap),
      new UserSavePersonalDetailsCommand(characters, bootstrap),
      new UserSkillsCommand(bootstrap),
      new UserStatsCommand(characters, catalog),
      new UserUnitframeCommand(unitOfWork, characters, bootstrap),
      new UserViewCommand(bootstrap),
      new UserMagicCommand(bootstrap, sheet),
      new UserFlashMessageCommand(bootstrap),
      new ChatConfCommand(bootstrap, sheet),
      new BookQuestListCommand(bootstrap, sheet),
      new EmptyCollectionOaCommand("companion|list_user_companions", "companions", bootstrap),
      new EmptyCollectionOaCommand("craft|user_recipes_list", "recipes", bootstrap),
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
      ),
      new PutOnCommand(unitOfWork, bootstrap, characters, inventory, catalog, combat),
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
      new UseArtifactCommand(unitOfWork, bootstrap, characters, inventory, combat),
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
      ),
      new ResurrectCommand(bootstrap, characters, combat),
      new StoreListCommand(characters, catalog),
      new StoreBuyCommand(bootstrap, characters, storePurchase),
      new StoreRepairCommand(bootstrap, sheet, characters, storeRepair),
    ]);
    this.fproxy = FproxyCommandRegistry.fromMeleeSourceIds(meleeSourceIds);
    this.esrv = EsrvCommandRegistry.create(combat, fightWire);
  }
}
