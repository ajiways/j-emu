import type { BootstrapReadModel, HeroStateBlock } from "../../application/bootstrap-read-model.ts";
import type { BookTrioBlocks } from "../../application/book-quest-blocks.ts";
import type { HeroSheetReadModel } from "../../application/hero-sheet-read-model.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

type BookQuestListResponse = BookTrioBlocks & Readonly<{ state: HeroStateBlock }>;

export class BookQuestListCommand implements OaCommand {
  static readonly key = "book|quest_list";
  readonly key = BookQuestListCommand.key;

  constructor(
    private readonly bootstrap: BootstrapReadModel,
    private readonly sheet: HeroSheetReadModel,
  ) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    const init = await this.bootstrap.init(accountId);
    const blocks: BookQuestListResponse = {
      ...this.sheet.bookTrio(filterTypeOf(envelope)),
      state: init.state,
    };
    return { kind: "flat", blocks };
  }
}

function filterTypeOf(envelope: ObjectActionEnvelope): string {
  const raw = envelope.form?.["filter_type"];
  if (raw === undefined) return "started";
  if (typeof raw !== "string" || !raw) {
    throw new Error("book|quest_list filter_type must be a non-empty string");
  }
  return raw;
}
