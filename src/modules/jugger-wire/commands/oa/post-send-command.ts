import type { MailSend } from "../../../../app/mail-send.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import { MailDeniedError } from "../../../mail/domain/mail-denied-error.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import { postSendMutation } from "../../application/post-send-mutation.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export class PostSendCommand implements OaCommand {
  static readonly key = "post|send";
  readonly key = PostSendCommand.key;

  constructor(
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly send: MailSend,
  ) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    try {
      const hero = await this.characters.getByAccountId(accountId);
      if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
      const form = envelope.form;
      if (truthy(form?.send_clan_members)) {
        throw new MailDeniedError("кланы не поддерживаются");
      }
      if (hasAttachments(form?.attachment)) {
        throw new MailDeniedError("вложения в этом срезе недоступны");
      }
      if (enclosedGold(form?.money) > 0) {
        throw new MailDeniedError("вложенное золото в этом срезе недоступно");
      }
      await this.send.send({
        fromHeroId: hero.id,
        nick: stringField(form?.nick),
        subject: stringField(form?.subject),
        text: stringField(form?.text),
      });
      return {
        kind: "flat",
        blocks: postSendMutation(
          await this.bootstrap.bag(accountId),
          await this.bootstrap.state(accountId),
        ),
      };
    } catch (error) {
      if (error instanceof MailDeniedError) throw new ProtocolError(203, error.message);
      throw error;
    }
  }
}

function stringField(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

function enclosedGold(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new ProtocolError(203, "Укажите сумму");
  return n;
}

function hasAttachments(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const entries = Array.isArray(raw)
    ? raw.map((v, i) => [String(i), v] as const)
    : Object.entries(raw as Record<string, unknown>);
  for (const [key, value] of entries) {
    const id = Number(key);
    const qty = Math.floor(Number(value));
    if (id > 0 && Number.isInteger(qty) && qty > 0) return true;
  }
  return false;
}

function truthy(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const s = String(value === undefined || value === null ? "" : value)
    .trim()
    .toLowerCase();
  return s === "1" || s === "true";
}
