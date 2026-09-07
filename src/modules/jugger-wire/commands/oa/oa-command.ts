import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export type OaCommandContext = Readonly<{ accountId: number }>;

export type OaEncodedResponse =
  Readonly<{ kind: "flat"; blocks: object }> | Readonly<{ kind: "nested"; value: object }>;

export interface OaCommand {
  readonly key: string;
  execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse>;
}
