import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { buildFightFinishBlocks } from "../../application/fight-finish-blocks.ts";
import { withSyncedResources } from "../../application/with-synced-resources.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import type { CombatPort } from "../../../combat/ports/combat-port.ts";
import type { WorldService } from "../../../world/domain/world-service.ts";
import type { UnitOfWork } from "../../../../shared/kernel/unit-of-work.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

export class FightFinishCommand implements OaCommand {
  static readonly key = "fight|finish";
  readonly key = FightFinishCommand.key;

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly characters: CharacterService,
    private readonly bootstrap: BootstrapReadModel,
    private readonly combat: CombatPort,
    private readonly world: WorldService,
  ) {}

  async execute(accountId: number): Promise<OaEncodedResponse> {
    const info = await this.combat.lastFightInfo(accountId);
    const areaTitle = info ? (await this.world.area(info.areaId)).title : null;
    return {
      kind: "flat",
      blocks: await withSyncedResources(this.unitOfWork, this.characters, accountId, () =>
        buildFightFinishBlocks(this.bootstrap, accountId, info, areaTitle),
      ),
    };
  }
}
