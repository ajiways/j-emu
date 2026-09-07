import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { flatBlockWithState } from "./flat-block-with-state.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

export class EmptyCollectionOaCommand implements OaCommand {
  constructor(
    readonly key: string,
    private readonly collectionKey: string,
    private readonly bootstrap: BootstrapReadModel,
  ) {
    if (!key) throw new Error("OA command key is required");
    if (!collectionKey) throw new Error("OA collection key is required");
  }

  async execute(accountId: number): Promise<OaEncodedResponse> {
    return flatBlockWithState(this.bootstrap, accountId, this.key, {
      status: 100,
      [this.collectionKey]: [],
    });
  }
}
