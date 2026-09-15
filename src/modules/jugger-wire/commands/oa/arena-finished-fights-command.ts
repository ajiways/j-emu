import type { CharacterService } from "../../../character/application/character-service.ts";
import type { CombatPort } from "../../../combat/ports/combat-port.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import { finishedFightListPayload } from "../../application/finished-fight-list-payload.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export class ArenaFinishedFightsCommand implements OaCommand {
  static readonly key = "arena|finished_fights";
  readonly key = ArenaFinishedFightsCommand.key;

  constructor(
    private readonly combat: CombatPort,
    private readonly characters: CharacterService,
  ) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    const hero = await this.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    const page = await this.combat.listFinishedFights({
      areaId: hero.areaId,
      ...parseFinishedFightsForm(envelope),
    });
    return { kind: "nested", value: finishedFightListPayload(page, hero.id) };
  }
}

function parseFinishedFightsForm(envelope: ObjectActionEnvelope): {
  page: number;
  nick?: string;
  type?: number;
  levelMin?: number;
  levelMax?: number;
} {
  const nick = optionalFormText(envelope, "nick");
  const type = optionalFormInt(envelope, "type");
  const levelMin = optionalFormInt(envelope, "level_min");
  const levelMax = optionalFormInt(envelope, "level_max");
  const requestedPage = optionalFormInt(envelope, "page");
  const page = requestedPage === undefined ? 1 : requestedPage;
  return {
    page,
    ...(nick === undefined ? {} : { nick }),
    ...(type === undefined ? {} : { type }),
    ...(levelMin === undefined ? {} : { levelMin }),
    ...(levelMax === undefined ? {} : { levelMax }),
  };
}

function formValue(envelope: ObjectActionEnvelope, key: string): unknown {
  return envelope.form?.[key] ?? envelope.input?.[key];
}

function optionalFormText(envelope: ObjectActionEnvelope, key: string): string | undefined {
  const raw = formValue(envelope, key);
  if (raw === undefined || raw === null || raw === "") return undefined;
  const value = String(raw).trim();
  return value === "" ? undefined : value;
}

function optionalFormInt(envelope: ObjectActionEnvelope, key: string): number | undefined {
  const raw = formValue(envelope, key);
  if (raw === undefined || raw === null || raw === "") return undefined;
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isInteger(value) || value < 1) {
    throw new ProtocolError(203, `arena|finished_fights ${key} is invalid`);
  }
  return value;
}
