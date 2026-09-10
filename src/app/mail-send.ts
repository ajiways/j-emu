import { goldToMinor } from "../modules/character/shared/gold-to-minor.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import { InsufficientMoneyError } from "../modules/character/domain/insufficient-money-error.ts";
import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import { MailBagTakeError } from "../modules/inventory/domain/mail-bag-take-error.ts";
import type { MailItemSnapshot } from "../modules/inventory/domain/mail-item-snapshot.ts";
import { INBOX_CAP } from "../modules/mail/domain/inbox-capacity.ts";
import { MailDeniedError } from "../modules/mail/domain/mail-denied-error.ts";
import { MAIL_FLAG_COD } from "../modules/mail/domain/mail-flags.ts";
import { MIN_MAIL_LEVEL } from "../modules/mail/domain/mail-level.ts";
import { MAIL_MAX_ATTACH, MAIL_POSTAGE_GOLD, mailTax } from "../modules/mail/domain/postage.ts";
import { TTL_COD_SEC, TTL_INBOX_SEC, TTL_OUTBOX_SEC } from "../modules/mail/domain/mail-ttl.ts";
import type { MailService } from "../modules/mail/application/mail-service.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import { letterAttachmentFromSnapshot } from "./mail-attachment-map.ts";

export type MailSendCommand = Readonly<{
  fromHeroId: number;
  nick: string;
  subject: string;
  text: string;
  moneyGold: number;
  attachments: readonly Readonly<{ itemId: number; quantity: number }>[];
  cod: boolean;
}>;

type MailCharacters = Pick<CharacterService, "lockById" | "getByNick" | "debitMoney">;
type MailPort = Pick<MailService, "inboxCount" | "deliverPlayerPair" | "sweepExpired">;
type MailInventory = Pick<InventoryService, "takeFromBagForMail">;

export class MailSend {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly characters: MailCharacters,
    private readonly mail: MailPort,
    private readonly inventory: MailInventory,
    private readonly catalog: Catalog,
  ) {}

  async send(command: MailSendCommand): Promise<void> {
    const nick = command.nick.trim();
    if (!nick) throw new MailDeniedError("Укажите адресата");
    if (command.cod && command.attachments.length < 1) {
      throw new MailDeniedError("Нельзя отправить письмо без вложенных вещей наложенным платежом");
    }
    if (command.cod && command.moneyGold <= 0) {
      throw new MailDeniedError("Укажите сумму выкупа");
    }
    if (command.attachments.length > MAIL_MAX_ATTACH) {
      throw new MailDeniedError("не больше 5 вложений");
    }
    const to = await this.characters.getByNick(nick);
    if (!to) throw new MailDeniedError("персонаж не найден");
    if (to.level < MIN_MAIL_LEVEL) throw new MailDeniedError("персонажу ещё рано получать почту");
    try {
      await this.unitOfWork.run(async () => {
        await this.mail.sweepExpired();
        const from = await this.characters.lockById(command.fromHeroId);
        if ((await this.mail.inboxCount(to.id)) >= INBOX_CAP) {
          throw new MailDeniedError("почтовый ящик получателя переполнен");
        }
        const snapshots: MailItemSnapshot[] = [];
        for (const spec of command.attachments) {
          snapshots.push(
            await this.inventory.takeFromBagForMail({
              characterId: from.id,
              itemId: spec.itemId,
              quantity: spec.quantity,
            }),
          );
        }
        const itemValueGold = await this.attachmentValueGold(snapshots);
        const enclosedGold = command.cod ? 0 : command.moneyGold;
        const taxValue = command.cod ? itemValueGold : enclosedGold + itemValueGold;
        const taxDebitGold = mailTax(taxValue, command.cod);
        const postageGold = command.cod ? 0 : MAIL_POSTAGE_GOLD;
        const debitMinor =
          goldToMinor(postageGold) + goldToMinor(taxDebitGold) + goldToMinor(enclosedGold);
        if (debitMinor > 0) {
          await this.characters.debitMoney({
            characterId: from.id,
            minorUnits: debitMinor,
            allowGhost: true,
          });
        }
        const letterTaxGold = command.cod ? mailTax(itemValueGold, false) : taxDebitGold;
        const ttl = command.cod ? TTL_COD_SEC : undefined;
        await this.mail.deliverPlayerPair({
          fromHeroId: from.id,
          fromNick: from.nick,
          toHeroId: to.id,
          toNick: to.nick,
          subject: command.subject,
          text: command.text,
          flags: command.cod ? MAIL_FLAG_COD : 0,
          moneyComeMinor: command.cod ? 0 : goldToMinor(enclosedGold),
          paymentMinor: command.cod ? goldToMinor(command.moneyGold) : 0,
          taxMinor: goldToMinor(letterTaxGold),
          attachments: snapshots.map(letterAttachmentFromSnapshot),
          ttlInboxSec: ttl === undefined ? TTL_INBOX_SEC : ttl,
          ttlOutboxSec: ttl === undefined ? TTL_OUTBOX_SEC : ttl,
        });
      });
    } catch (error) {
      if (error instanceof InsufficientMoneyError) {
        throw new MailDeniedError("Недостаточно денег");
      }
      if (error instanceof MailBagTakeError) throw new MailDeniedError(error.message);
      throw error;
    }
  }

  private async attachmentValueGold(snapshots: readonly MailItemSnapshot[]): Promise<number> {
    let sum = 0;
    for (const snap of snapshots) {
      const definition = await this.catalog.artifact(snap.artifactId);
      if (!definition) throw new Error(`Artifact catalog entry ${snap.artifactId} is missing`);
      sum += (definition.priceMinor / 100) * snap.quantity;
    }
    return sum;
  }
}
