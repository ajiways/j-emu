import { buildArtifactImgMacro } from "../modules/chat/domain/artifact-macro.ts";
import { buildImageMacro } from "../modules/chat/domain/image-macro.ts";
import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { EsrvOutbox } from "../modules/jugger-wire/application/esrv-outbox.ts";
import { levelUpWindow } from "../modules/jugger-wire/application/level-up-window.ts";
import { requireWireIdentity } from "../shared/kernel/decimal-id.ts";
import { loadArtifactMacroSource } from "./load-artifact-macro-source.ts";

const GREETING_IMAGE = "/images/data/upl/text_pozdrav.png";

export class LevelUpNotifier {
  constructor(
    private readonly catalog: Catalog,
    private readonly outbox: EsrvOutbox,
    private readonly wake: Readonly<{ wake(accountId: number): void }>,
  ) {}

  /** One window per reached level that has an authored notice; none for levels without one. */
  async notify(accountId: number, levelBefore: number, levelAfter: number): Promise<void> {
    requireWireIdentity(accountId, "account id");
    if (
      !Number.isInteger(levelBefore) ||
      !Number.isInteger(levelAfter) ||
      levelAfter < levelBefore
    ) {
      throw new Error(`Level change ${levelBefore} -> ${levelAfter} is invalid`);
    }
    let queued = false;
    for (let level = levelBefore + 1; level <= levelAfter; level += 1) {
      const notice = await this.catalog.levelNotice(level);
      if (notice === null) continue;
      const artifacts = [];
      for (const artikulId of notice.artikulIds) {
        artifacts.push(
          buildArtifactImgMacro(await loadArtifactMacroSource(this.catalog, artikulId)),
        );
      }
      this.outbox.enqueue(accountId, {
        "common|window": levelUpWindow({
          headline: notice.headline,
          body: notice.body,
          achievement: buildImageMacro(notice.achievementImage),
          greeting: buildImageMacro(GREETING_IMAGE),
          artifacts,
        }),
      });
      queued = true;
    }
    if (queued) this.wake.wake(accountId);
  }
}
