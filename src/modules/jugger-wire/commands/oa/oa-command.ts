import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export type OaCommandContext = Readonly<{ accountId: string }>;

export type OaEncodedResponse =
  Readonly<{ kind: "flat"; blocks: object }> | Readonly<{ kind: "nested"; value: object }>;

export interface OaCommand {
  readonly key: string;
  execute(accountId: string, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse>;
}
