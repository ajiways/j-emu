import type { BookDesk } from "../../../../app/book-desk.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export const BOOK_OA_KEYS = ["book|bestiary_info", "book|instances"] as const;

export class BookOaCommand implements OaCommand {
  constructor(
    readonly key: string,
    private readonly desk: BookDesk,
  ) {}

  execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    void envelope;
    return this.desk.execute(this.key, accountId);
  }
}
