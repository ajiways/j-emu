import { describe, expect, it } from "vitest";
import { MailDeniedError } from "../../../src/modules/mail/domain/mail-denied-error.ts";
import { MailSend } from "../../../src/app/mail-send.ts";
import { InsufficientMoneyError } from "../../../src/modules/character/domain/insufficient-money-error.ts";
import { testHero } from "../../support/hero-fixtures.ts";

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
      },
    );
    await expect(
      send.send({ fromHeroId: 1, nick: "  ", subject: "", text: "" }),
    ).rejects.toBeInstanceOf(MailDeniedError);
    await expect(
      send.send({ fromHeroId: 1, nick: "Missing", subject: "", text: "" }),
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
      },
    );
    await expect(
      send.send({ fromHeroId: 1, nick: "Bee", subject: "Hi", text: "body" }),
    ).rejects.toMatchObject({ message: "Недостаточно денег" });
  });
});
