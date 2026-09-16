import type { InstanceDesk } from "../../../../app/instance-desk.ts";
import { InstanceDeniedError } from "../../../instance/domain/instance-denied-error.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import type { CombatPort } from "../../../combat/ports/combat-port.ts";
import { ResurrectUnavailableError } from "../../../character/domain/resurrect-unavailable-error.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import type { PresenceFanout } from "../../application/presence-fanout.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import { OUTDOOR_TEMPLE_AREA_ID } from "../../../world/domain/outdoor-temple-area.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import { requireNoActiveFight } from "./require-no-active-fight.ts";

export class ResurrectCommand implements OaCommand {
  static readonly key = "common|object:RESURRECT";
  readonly key = ResurrectCommand.key;

  constructor(
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly combat: CombatPort,
    private readonly instances: InstanceDesk,
    private readonly presence: PresenceFanout,
  ) {}

  async execute(accountId: number): Promise<OaEncodedResponse> {
    await requireNoActiveFight(this.combat, accountId);
    const hero = await this.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    try {
      await this.characters.resurrect({ characterId: hero.id });
      if (hero.instanceCopyId === null) {
        await this.moveOutdoorToTemple(accountId, hero.id, hero.areaId);
      } else {
        const current = await this.characters.getByAccountId(accountId);
        if (!current) throw new Error(`Hero for account ${accountId} is missing`);
        await this.instances.ensureResurrectArea(current);
      }
    } catch (error) {
      if (error instanceof ResurrectUnavailableError) {
        throw new ProtocolError(203, "воскрешение недоступно");
      }
      if (error instanceof InstanceDeniedError) {
        throw new ProtocolError(error.status, error.message);
      }
      throw error;
    }
    return { kind: "flat", blocks: await this.bootstrap.resurrectMutation(accountId) };
  }

  private async moveOutdoorToTemple(
    accountId: number,
    characterId: number,
    fromAreaId: string,
  ): Promise<void> {
    if (fromAreaId === OUTDOOR_TEMPLE_AREA_ID) return;
    await this.characters.setArea({
      characterId,
      areaId: OUTDOOR_TEMPLE_AREA_ID,
      moveReadyAt: null,
      instanceCopyId: null,
    });
    await this.presence.afterMove(accountId, fromAreaId, OUTDOOR_TEMPLE_AREA_ID, null);
  }
}
