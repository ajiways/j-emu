import type { CharacterService } from "../modules/character/application/character-service.ts";
import { InsufficientMoneyError } from "../modules/character/domain/insufficient-money-error.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import { MailBagFullError } from "../modules/inventory/domain/mail-bag-full-error.ts";
import { MailDeniedError } from "../modules/mail/domain/mail-denied-error.ts";
import { isPendingCodInbox } from "../modules/mail/domain/pending-cod.ts";
import type { Letter } from "../modules/mail/domain/letter.ts";
import type { MailService } from "../modules/mail/application/mail-service.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import { mailSnapshotFromAttachment } from "./mail-attachment-map.ts";

type MailCharacters = Pick<CharacterService, "lockById" | "debitMoney" | "creditMoney">;
type MailInventory = Pick<InventoryService, "canFitMailSnapshots" | "grantMailSnapshots">;
type MailPort = Pick<
  MailService,
  "sweepExpired" | "lockInbox" | "markPicked" | "remove" | "deliverSystemInbox" | "returnCodInbox"
>;

export class MailClaim {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly characters: MailCharacters,
    private readonly mail: MailPort,
    private readonly inventory: MailInventory,
  ) {}

  async pick(command: { heroId: number; letterId: number; deleteLetter: boolean }): Promise<void> {
    try {
      await this.unitOfWork.run(async () => {
        await this.mail.sweepExpired();
        const hero = await this.characters.lockById(command.heroId);
        const letter = await this.mail.lockInbox(hero.id, command.letterId);
        if (!letter) throw new MailDeniedError("письмо не найдено");
        await this.pickLocked(hero.id, hero.nick, letter, command.deleteLetter);
      });
    } catch (error) {
      if (error instanceof InsufficientMoneyError) {
        throw new MailDeniedError("Недостаточно денег");
      }
      if (error instanceof MailBagFullError) throw new MailDeniedError(error.message);
      throw error;
    }
  }

  async batchPick(command: { heroId: number; letterIds: readonly number[] }): Promise<void> {
    if (command.letterIds.length < 1) throw new MailDeniedError("Ни одно сообщение не отмечено");
    try {
      await this.unitOfWork.run(async () => {
        await this.mail.sweepExpired();
        const hero = await this.characters.lockById(command.heroId);
        const packed: Letter[] = [];
        const snapshots = [];
        for (const letterId of command.letterIds) {
          const letter = await this.mail.lockInbox(hero.id, letterId);
          if (!letter) throw new MailDeniedError("письмо не найдено");
          if (isPendingCodInbox(letter)) {
            throw new MailDeniedError("наложенный платёж нельзя забрать пачкой");
          }
          packed.push(letter);
          snapshots.push(...letter.attachments.map(mailSnapshotFromAttachment));
        }
        const fits = await this.inventory.canFitMailSnapshots({
          characterId: hero.id,
          snapshots,
        });
        if (!fits) throw new MailDeniedError("в рюкзаке нет места");
        for (const letter of packed) {
          await this.pickLocked(hero.id, hero.nick, letter, true);
        }
      });
    } catch (error) {
      if (error instanceof InsufficientMoneyError) {
        throw new MailDeniedError("Недостаточно денег");
      }
      if (error instanceof MailBagFullError) throw new MailDeniedError(error.message);
      throw error;
    }
  }

  async retract(command: { heroId: number; letterId: number }): Promise<void> {
    await this.unitOfWork.run(async () => {
      await this.mail.sweepExpired();
      const hero = await this.characters.lockById(command.heroId);
      const letter = await this.mail.lockInbox(hero.id, command.letterId);
      if (!letter) throw new MailDeniedError("письмо не найдено");
      await this.mail.returnCodInbox(letter, hero.nick, hero.id);
    });
  }

  private async pickLocked(
    heroId: number,
    heroNick: string,
    letter: Letter,
    deleteLetter: boolean,
  ): Promise<void> {
    const snapshots = letter.attachments.map(mailSnapshotFromAttachment);
    if (isPendingCodInbox(letter)) {
      const costMinor = letter.paymentMinor + letter.taxMinor;
      const fits = await this.inventory.canFitMailSnapshots({ characterId: heroId, snapshots });
      if (!fits) throw new MailDeniedError("в рюкзаке нет места");
      if (costMinor > 0) {
        await this.characters.debitMoney({
          characterId: heroId,
          minorUnits: costMinor,
          allowGhost: true,
        });
      }
      await this.inventory.grantMailSnapshots({ characterId: heroId, snapshots });
      if (letter.peerHeroId !== null && letter.paymentMinor > 0) {
        await this.mail.deliverSystemInbox({
          toHeroId: letter.peerHeroId,
          fromNick: heroNick,
          fromHeroId: heroId,
          subject: "Оплата наложенного платежа",
          text: letter.subject,
          flags: 0,
          moneyComeMinor: letter.paymentMinor,
          attachments: [],
        });
      }
    } else {
      const fits = await this.inventory.canFitMailSnapshots({ characterId: heroId, snapshots });
      if (!fits) throw new MailDeniedError("в рюкзаке нет места");
      await this.inventory.grantMailSnapshots({ characterId: heroId, snapshots });
      if (letter.moneyComeMinor > 0) {
        await this.characters.creditMoney({
          characterId: heroId,
          minorUnits: letter.moneyComeMinor,
        });
      }
    }
    if (deleteLetter) await this.mail.remove(letter.id);
    else await this.mail.markPicked(letter);
  }
}
