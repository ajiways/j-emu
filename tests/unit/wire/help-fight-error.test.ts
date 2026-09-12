import { describe, expect, it } from "vitest";
import { HuntJoinDenied } from "../../../src/modules/combat/domain/hunt-join-denied.ts";
import { asHelpFightError } from "../../../src/modules/jugger-wire/application/help-fight-error.ts";
import { ProtocolError } from "../../../src/modules/jugger-wire/application/protocol-error.ts";

describe("asHelpFightError", () => {
  it("maps dump HELP/JOIN denials to 203/204 texts", () => {
    expect(asHelpFightError(new HuntJoinDenied("уже в бою"))).toMatchObject({
      status: 203,
      message: "нельзя во время боя",
    });
    expect(asHelpFightError(new HuntJoinDenied("бой в другой локации"))).toMatchObject({
      status: 204,
      message: "Нельзя вмешаться в бой, находящийся в другой локации!",
    });
    expect(asHelpFightError(new HuntJoinDenied("игрок не в бою"))).toMatchObject({
      status: 204,
      message: "Данный игрок сейчас не участвует в боях!",
    });
    expect(asHelpFightError(new HuntJoinDenied("бой не найден"))).toMatchObject({
      status: 204,
      message: "Нельзя вмешаться в неактивный бой!",
    });
    expect(asHelpFightError(new HuntJoinDenied("нельзя вмешаться в квестовый бой"))).toMatchObject({
      status: 204,
      message: "нельзя вмешаться в квестовый бой",
    });
    const keep = new ProtocolError(203, "нельзя во время боя");
    expect(asHelpFightError(keep)).toBe(keep);
  });
});
