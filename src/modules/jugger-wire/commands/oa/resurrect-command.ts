import type { CharacterService } from "../../../character/application/character-service.ts";
import type { CombatPort } from "../../../combat/ports/combat-port.ts";
import { ResurrectUnavailableError } from "../../../character/domain/resurrect-unavailable-error.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import { requireNoActiveFight } from "./require-no-active-fight.ts";

export class ResurrectCommand implements OaCommand {
  static readonly key = "common|object:RESURRECT";
  readonly key = ResurrectCommand.key;

  constructor(
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly combat: CombatPort,
  ) {}

  async execute(accountId: number): Promise<OaEncodedResponse> {
    await requireNoActiveFight(this.combat, accountId);
    const hero = await this.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    try {
      await this.characters.resurrect({ characterId: hero.id });
    } catch (error) {
      if (error instanceof ResurrectUnavailableError) {
        throw new ProtocolError(203, "воскрешение недоступно");
      }
      throw error;
    }
    return { kind: "flat", blocks: await this.bootstrap.resurrectMutation(accountId) };
  }
}
