import type { BootstrapReadModel, HeroStateBlock } from "../../application/bootstrap-read-model.ts";
import type { UserUnitframeBlock } from "../../application/user-unitframe-block.ts";
import { withSyncedResources } from "../../application/with-synced-resources.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import type { UnitOfWork } from "../../../../shared/kernel/unit-of-work.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

type UserUnitframeBlocks = Readonly<{
  "user|unitframe": UserUnitframeBlock;
  state: HeroStateBlock;
}>;

export class UserUnitframeCommand implements OaCommand {
  static readonly key = "user|unitframe";
  readonly key = UserUnitframeCommand.key;

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly characters: CharacterService,
    private readonly bootstrap: BootstrapReadModel,
  ) {}

  async execute(accountId: number): Promise<OaEncodedResponse> {
    const blocks: UserUnitframeBlocks = await withSyncedResources(
      this.unitOfWork,
      this.characters,
      accountId,
      async () => ({
        "user|unitframe": await this.bootstrap.unitframe(accountId),
        state: await this.bootstrap.state(accountId),
      }),
    );
    return { kind: "flat", blocks };
  }
}
