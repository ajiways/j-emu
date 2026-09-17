import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../character/application/character-service.ts";
import { InventoryItem } from "../../inventory/domain/inventory-item.ts";
import type { LetterAttachment } from "../../mail/domain/letter-attachment.ts";
import type { Letter } from "../../mail/domain/letter.ts";
import { MAIL_FOLDER_OUTBOX, type MailFolder } from "../../mail/domain/mail-folder.ts";
import { buildBagItemBlock } from "./bag-item-block.ts";
import { moneyFromMinorUnits, moneyNumberFromMinorUnits } from "./money-from-minor-units.ts";
import { buildUserMacro, SYSTEM_MAIL_PEER, type UserMacroSource } from "./user-macro.ts";

type MailPeer = UserMacroSource;

export async function loadMailPeers(
  rows: readonly Letter[],
  characters: Pick<CharacterService, "getById">,
): Promise<ReadonlyMap<number, MailPeer>> {
  const ids = [
    ...new Set(rows.map((letter) => letter.peerHeroId).filter((id): id is number => id !== null)),
  ];
  const peers = new Map<number, MailPeer>();
  for (const id of ids) {
    const hero = await characters.getById(id);
    if (!hero) throw new Error(`Mail peer hero ${id} is missing`);
    peers.set(id, { nick: hero.nick, level: hero.level, kind: hero.kind });
  }
  return peers;
}

export async function buildLetterListBlock(
  rows: readonly Letter[],
  folder: MailFolder,
  peers: ReadonlyMap<number, MailPeer>,
  catalog: Catalog,
): Promise<Readonly<{ status: 100; list: unknown; macros_list: unknown }>> {
  if (rows.length < 1) {
    return { status: 100, list: [], macros_list: [] };
  }
  const macros: Record<string, object> = {};
  const list: Record<string, object> = {};
  for (const letter of rows) {
    list[String(letter.id)] = await letterToWire(
      letter,
      folder,
      macros,
      peerOf(letter, peers),
      catalog,
    );
  }
  return {
    status: 100,
    list,
    macros_list: Object.keys(macros).length > 0 ? macros : [],
  };
}

function peerOf(letter: Letter, peers: ReadonlyMap<number, MailPeer>): MailPeer {
  if (letter.peerHeroId === null) {
    return { ...SYSTEM_MAIL_PEER, nick: letter.peerNick };
  }
  const peer = peers.get(letter.peerHeroId);
  if (!peer) throw new Error(`Mail peer hero ${letter.peerHeroId} was not loaded`);
  return peer;
}

async function letterToWire(
  letter: Letter,
  folder: MailFolder,
  macros: Record<string, object>,
  peer: MailPeer,
  catalog: Catalog,
): Promise<object> {
  const token = buildUserMacro(peer);
  macros[token.key] = token.macro;
  const row: Record<string, unknown> = {
    id: letter.id,
    subject: letter.subject,
    text: letter.body,
    money_type: String(letter.moneyType),
    flags: letter.flags,
    stime: unixSeconds(letter.sentAt),
    rtime: unixSeconds(letter.expiresAt),
    money_come: moneyFromMinorUnits(letter.moneyComeMinor),
    payment: moneyNumberFromMinorUnits(letter.paymentMinor),
    tax: moneyNumberFromMinorUnits(letter.taxMinor),
    artifact_list: await artifactListWire(letter, catalog),
  };
  if (folder === MAIL_FOLDER_OUTBOX) row.to_nick = token.token;
  else row.from_nick = token.token;
  return row;
}

async function artifactListWire(letter: Letter, catalog: Catalog): Promise<unknown> {
  if (letter.attachments.length < 1) return [];
  const list: Record<string, object> = {};
  for (const attachment of letter.attachments) {
    const definition = await catalog.artifact(attachment.artifactId);
    if (!definition) {
      throw new Error(`Artifact catalog entry ${attachment.artifactId} is missing`);
    }
    const item = itemFromAttachment(letter.ownerHeroId, attachment);
    list[String(attachment.originalItemId)] = await buildBagItemBlock(definition, item, catalog);
  }
  return list;
}

function itemFromAttachment(ownerHeroId: number, attachment: LetterAttachment): InventoryItem {
  return new InventoryItem(
    attachment.originalItemId,
    ownerHeroId,
    attachment.artifactId,
    attachment.quantity,
    { kind: "bag" },
    attachment.durability,
    attachment.durabilityMax,
    {
      id: attachment.upgradeId,
      level: attachment.upgradeLevel,
      skillId: attachment.upgradeSkillId,
      bound: attachment.upgradeBound === 1,
    },
    0,
    attachment.data,
  );
}

function unixSeconds(value: Date): number {
  const seconds = Math.floor(value.getTime() / 1000);
  if (!Number.isInteger(seconds)) throw new Error("Letter timestamp is invalid");
  return seconds;
}
