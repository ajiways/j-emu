import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { withSyncedResources } from "../../application/with-synced-resources.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import type { UnitOfWork } from "../../../../shared/kernel/unit-of-work.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

export class CommonInit2Command implements OaCommand {
  static readonly key = "common|init2";
  readonly key = CommonInit2Command.key;

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly characters: CharacterService,
    private readonly bootstrap: BootstrapReadModel,
  ) {}

  async execute(accountId: number): Promise<OaEncodedResponse> {
    return {
      kind: "flat",
      blocks: await withSyncedResources(this.unitOfWork, this.characters, accountId, () =>
        this.bootstrap.init2(accountId),
      ),
    };
  }
}
