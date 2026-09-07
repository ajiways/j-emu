import type { BootstrapReadModel, HeroStateBlock } from "../../application/bootstrap-read-model.ts";
import type { OaEncodedResponse } from "./oa-command.ts";

export async function flatBlockWithState(
  bootstrap: BootstrapReadModel,
  accountId: number,
  key: string,
  block: object,
): Promise<OaEncodedResponse> {
  if (!key) throw new Error("OA response key is required");
  const init = await bootstrap.init(accountId);
  const blocks: Record<string, object> & { state: HeroStateBlock } = {
    [key]: block,
    state: init.state,
  };
  return { kind: "flat", blocks };
}
