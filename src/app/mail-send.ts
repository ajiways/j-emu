import { goldToMinor } from "../modules/character/shared/gold-to-minor.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import { InsufficientMoneyError } from "../modules/character/domain/insufficient-money-error.ts";
import { INBOX_CAP } from "../modules/mail/domain/inbox-capacity.ts";
import { MailDeniedError } from "../modules/mail/domain/mail-denied-error.ts";
import { MIN_MAIL_LEVEL } from "../modules/mail/domain/mail-level.ts";
import { MAIL_POSTAGE_GOLD, mailTax } from "../modules/mail/domain/postage.ts";
import type { MailService } from "../modules/mail/application/mail-service.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";

type MailSendCommand = Readonly<{
  fromHeroId: number;
  nick: string;
  subject: string;
  text: string;
}>;

type MailCharacters = Pick<CharacterService, "lockById" | "getByNick" | "debitMoney">;

type MailPort = Pick<MailService, "inboxCount" | "deliverPlayerPair">;

export class MailSend {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly characters: MailCharacters,
    private readonly mail: MailPort,
  ) {}

  async send(command: MailSendCommand): Promise<void> {
    const nick = command.nick.trim();
    if (!nick) throw new MailDeniedError("Укажите адресата");
    const to = await this.characters.getByNick(nick);
    if (!to) throw new MailDeniedError("персонаж не найден");
    if (to.level < MIN_MAIL_LEVEL) throw new MailDeniedError("персонажу ещё рано получать почту");
    const postageMinor = goldToMinor(MAIL_POSTAGE_GOLD) + goldToMinor(mailTax(0));
    try {
      await this.unitOfWork.run(async () => {
        const from = await this.characters.lockById(command.fromHeroId);
        if ((await this.mail.inboxCount(to.id)) >= INBOX_CAP) {
          throw new MailDeniedError("почтовый ящик получателя переполнен");
        }
        await this.characters.debitMoney({
          characterId: from.id,
          minorUnits: postageMinor,
          allowGhost: true,
        });
        await this.mail.deliverPlayerPair({
          fromHeroId: from.id,
          fromNick: from.nick,
          toHeroId: to.id,
          toNick: to.nick,
          subject: command.subject,
          text: command.text,
        });
      });
    } catch (error) {
      if (error instanceof InsufficientMoneyError) {
        throw new MailDeniedError("Недостаточно денег");
      }
      throw error;
    }
  }
}
