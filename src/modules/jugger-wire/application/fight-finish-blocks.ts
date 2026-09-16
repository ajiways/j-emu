import { emptyUserMagic } from "./user-magic-block.ts";
import type { BootstrapReadModel } from "./bootstrap-read-model.ts";

export async function buildFightFinishBlocks(
  bootstrap: BootstrapReadModel,
  accountId: number,
): Promise<Readonly<Record<string, unknown>>> {
  return {
    "fight|finish": { status: 100 },
    "fight|conf": { expire: 0 },
    "user|unitframe": await bootstrap.unitframe(accountId),
    "user|bag": await bootstrap.bag(accountId),
    "user|view": await bootstrap.view(accountId),
    "user|magic": emptyUserMagic(),
    "user|skills": await bootstrap.skills(accountId),
    state: await bootstrap.state(accountId),
  };
}
