import type { AppConfig } from "../../../../app/config.ts";
import type { PlayableAccountRegistration } from "../../../../app/playable-account-registration.ts";
import type { PlayableDevelopmentIdentity } from "../../../../app/playable-development-identity.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import type { CombatPort } from "../../../combat/ports/combat-port.ts";
import type { IdentityService } from "../../../identity/application/identity-service.ts";
import type { InventoryService } from "../../../inventory/domain/inventory-service.ts";
import type { LongPollCoordinator } from "../../application/long-poll-coordinator.ts";
import type { JuggerCommandModule } from "../../registry/jugger-command-module.ts";

export type JuggerHttpDependencies = Readonly<{
  config: AppConfig;
  identity: IdentityService;
  registration: PlayableAccountRegistration;
  developmentIdentity: PlayableDevelopmentIdentity;
  characters: CharacterService;
  inventory: InventoryService;
  commands: JuggerCommandModule;
  combat: CombatPort;
  longPoll: LongPollCoordinator;
}>;
