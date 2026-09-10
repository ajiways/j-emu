import { describe, expect, it } from "vitest";
import type { Catalog } from "../../../src/modules/catalog/ports/catalog.ts";
import { MailDeniedError } from "../../../src/modules/mail/domain/mail-denied-error.ts";
import { MailSend } from "../../../src/app/mail-send.ts";
import { InsufficientMoneyError } from "../../../src/modules/character/domain/insufficient-money-error.ts";
import { testHero } from "../../support/hero-fixtures.ts";

const unusedInventory = {
  takeFromBagForMail: async () => {
    throw new Error("must not take bag");
  },
};

const unusedCatalog = {
  artifact: async () => {
    throw new Error("must not read catalog");
  },
} as unknown as Catalog;

describe("MailSend", () => {
  it("rejects an empty nick and a missing recipient before debit", async () => {
    const send = new MailSend(
      { run: async (work) => work() },
      {
        lockById: async () => {
          throw new Error("must not lock");
        },
        getByNick: async () => null,
        debitMoney: async () => {
          throw new Error("must not debit");
        },
      },
      {
        inboxCount: async () => 0,
        deliverPlayerPair: async () => {
          throw new Error("must not deliver");
        },
        sweepExpired: async () => {
          throw new Error("must not sweep");
        },
      },
      unusedInventory,
      unusedCatalog,
    );
    await expect(
      send.send({
        fromHeroId: 1,
        nick: "  ",
        subject: "",
        text: "",
        moneyGold: 0,
        attachments: [],
        cod: false,
      }),
    ).rejects.toBeInstanceOf(MailDeniedError);
    await expect(
      send.send({
        fromHeroId: 1,
        nick: "Missing",
        subject: "",
        text: "",
        moneyGold: 0,
        attachments: [],
        cod: false,
      }),
    ).rejects.toMatchObject({ message: "персонаж не найден" });
  });

  it("maps insufficient gold to the dump mail error", async () => {
    const from = testHero({ id: 1, nick: "Ada" });
    const to = testHero({ id: 2, nick: "Bee" });
    const send = new MailSend(
      { run: async (work) => work() },
      {
        lockById: async () => from,
        getByNick: async () => to,
        debitMoney: async () => {
          throw new InsufficientMoneyError(0, 100);
        },
      },
      {
        inboxCount: async () => 0,
        deliverPlayerPair: async () => {
          throw new Error("must not deliver");
        },
        sweepExpired: async () => undefined,
      },
      unusedInventory,
      unusedCatalog,
    );
    await expect(
      send.send({
        fromHeroId: 1,
        nick: "Bee",
        subject: "Hi",
        text: "body",
        moneyGold: 0,
        attachments: [],
        cod: false,
      }),
    ).rejects.toMatchObject({ message: "Недостаточно денег" });
  });

  it("rejects COD without attachments", async () => {
    const send = new MailSend(
      { run: async (work) => work() },
      {
        lockById: async () => {
          throw new Error("must not lock");
        },
        getByNick: async () => testHero({ id: 2, nick: "Bee" }),
        debitMoney: async () => {
          throw new Error("must not debit");
        },
      },
      {
        inboxCount: async () => 0,
        deliverPlayerPair: async () => {
          throw new Error("must not deliver");
        },
        sweepExpired: async () => undefined,
      },
      unusedInventory,
      unusedCatalog,
    );
    await expect(
      send.send({
        fromHeroId: 1,
        nick: "Bee",
        subject: "",
        text: "",
        moneyGold: 3,
        attachments: [],
        cod: true,
      }),
    ).rejects.toMatchObject({
      message: "Нельзя отправить письмо без вложенных вещей наложенным платежом",
    });
  });
});
