import type { AppConfig } from "../../../../app/config.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import type { CombatPort } from "../../../combat/ports/combat-port.ts";
import type { IdentityService } from "../../../identity/application/identity-service.ts";
import type { InventoryService } from "../../../inventory/domain/inventory-service.ts";
import type { LongPollCoordinator } from "../../application/long-poll-coordinator.ts";
import type { JuggerCommandModule } from "../../registry/jugger-command-module.ts";

export type JuggerHttpDependencies = Readonly<{
  config: AppConfig;
  identity: IdentityService;
  characters: CharacterService;
  inventory: InventoryService;
  commands: JuggerCommandModule;
  combat: CombatPort;
  longPoll: LongPollCoordinator;
}>;
