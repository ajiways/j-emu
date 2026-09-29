import { buildArtifactImgMacro } from "../modules/chat/domain/artifact-macro.ts";
import { buildImageMacro } from "../modules/chat/domain/image-macro.ts";
import { honorRankCatalogFromConf } from "../modules/catalog/domain/honor-progress.ts";
import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { EsrvOutbox } from "../modules/jugger-wire/application/esrv-outbox.ts";
import { progressWindow } from "../modules/jugger-wire/application/progress-window.ts";
import { requireWireIdentity } from "../shared/kernel/decimal-id.ts";
import { loadArtifactMacroSource } from "./load-artifact-macro-source.ts";
import { rankNotice } from "./rank-notice.ts";
import { macrosReferencedBy } from "./text-macros.ts";

const GREETING_IMAGE = "/images/data/upl/text_pozdrav.png";

/** Level-up and rank-up `common|window` notices; each goes out as its own esrv frame. */
export class ProgressNotifier {
  constructor(
    private readonly catalog: Catalog,
    private readonly outbox: EsrvOutbox,
    private readonly wake: Readonly<{ wake(accountId: number): void }>,
  ) {}

  /** One window per reached level that has an authored notice; none for levels without one. */
  async notifyLevel(accountId: number, levelBefore: number, levelAfter: number): Promise<void> {
    requireWireIdentity(accountId, "account id");
    requireRange("Level", levelBefore, levelAfter);
    const conf = await this.catalog.commonConf();
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
      this.enqueue(
        accountId,
        progressWindow({
          headline: notice.headline,
          body: notice.body,
          achievement:
            notice.achievementImage === undefined ? null : buildImageMacro(notice.achievementImage),
          greeting: buildImageMacro(GREETING_IMAGE),
          artifacts,
          bodyMacros: macrosReferencedBy(notice.body, conf.macros_list),
        }),
      );
      queued = true;
    }
    if (queued) this.wake.wake(accountId);
  }

  /** One window per reached rank, built from the rank table; `heroLevel` picks the next-rank hint. */
  async notifyRank(
    accountId: number,
    rankBefore: number,
    rankAfter: number,
    heroLevel: number,
  ): Promise<void> {
    requireWireIdentity(accountId, "account id");
    requireRange("Rank", rankBefore, rankAfter);
    const conf = await this.catalog.commonConf();
    const ranks = honorRankCatalogFromConf(conf);
    for (let rank = rankBefore + 1; rank <= rankAfter; rank += 1) {
      const notice = rankNotice({ conf, ranks, rank, heroLevel });
      this.enqueue(
        accountId,
        progressWindow({
          headline: notice.headline,
          body: notice.body,
          achievement: null,
          greeting: buildImageMacro(GREETING_IMAGE),
          artifacts: [],
          bodyMacros: macrosReferencedBy(notice.body, conf.macros_list),
        }),
      );
    }
    if (rankAfter > rankBefore) this.wake.wake(accountId);
  }

  private enqueue(accountId: number, window: Readonly<Record<string, unknown>>): void {
    this.outbox.enqueue(accountId, { "common|window": window });
  }
}

function requireRange(label: string, before: number, after: number): void {
  if (!Number.isInteger(before) || !Number.isInteger(after) || after < before) {
    throw new Error(`${label} change ${before} -> ${after} is invalid`);
  }
}
