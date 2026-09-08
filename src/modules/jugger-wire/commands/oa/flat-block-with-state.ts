import type { BootstrapReadModel, HeroStateBlock } from "../../application/bootstrap-read-model.ts";
import type { OaEncodedResponse } from "./oa-command.ts";

export async function flatBlockWithState(
  bootstrap: BootstrapReadModel,
  accountId: number,
  key: string,
  block: object,
): Promise<OaEncodedResponse> {
  if (!key) throw new Error("OA response key is required");
  const blocks: Record<string, object> & { state: HeroStateBlock } = {
    [key]: block,
    state: await bootstrap.state(accountId),
  };
  return { kind: "flat", blocks };
}
