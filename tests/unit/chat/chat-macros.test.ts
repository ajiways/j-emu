import { describe, expect, it } from "vitest";
import { chatCrc } from "../../../src/modules/chat/domain/chat-crc.ts";
import {
  expandFightHashTags,
  expandFightKeywords,
} from "../../../src/modules/chat/domain/expand-fight-tags.ts";
import { expandEmoFlavor } from "../../../src/modules/chat/domain/expand-emo.ts";
import { EMO_TEMPLATES } from "../../../src/modules/chat/domain/emo-templates.ts";
import { expandSmileTags } from "../../../src/modules/chat/domain/expand-smiles.ts";
import { buildFightMacro, huntFightTitle } from "../../../src/modules/chat/domain/fight-macro.ts";
import { buildMoneyMacro } from "../../../src/modules/chat/domain/money-macro.ts";
import { parseEmoCommand } from "../../../src/modules/chat/domain/parse-emo-command.ts";
import { isChatOnlyFragment } from "../../../src/modules/jugger-wire/application/esrv-chat-only-fragment.ts";
import { buildUserMacro } from "../../../src/modules/jugger-wire/application/user-macro.ts";

describe("chat macros", () => {
  it("crc is 8 lowercase hex chars and stable", () => {
    expect(chatCrc("hello")).toMatch(/^[0-9a-f]{8}$/);
    expect(chatCrc("hello")).toBe(chatCrc("hello"));
    expect(chatCrc("hello")).not.toBe(chatCrc("Hello"));
  });

  it("replaces at most three smile tags, longest first", () => {
    const macroses: Record<string, unknown> = {};
    const msg = expandSmileTags(
      ":):D:):):D",
      [
        { tag: ":D", smile: "D.swf", expire_time: 0 },
        { tag: ":)", smile: "smile.swf", expire_time: 0 },
      ],
      macroses,
    );
    expect(msg).toMatch(/\[\[SMILE /);
    expect(Object.keys(macroses)).toHaveLength(2);
    expect((msg.match(/\[\[SMILE /g) ?? []).length).toBe(3);
  });

  it("expands (бой) only when the sender is in a fight", () => {
    const macroses: Record<string, unknown> = {};
    const context = {
      areaId: "503",
      areaTitle: "Радвей",
      activeFightId: "12",
      fightTitleFor: () => "бой12",
    };
    expect(
      expandFightKeywords("go (бой) now", { ...context, activeFightId: null }, macroses, new Map()),
    ).toBe("go (бой) now");
    const inFight = expandFightKeywords("go (бой) now", context, macroses, new Map());
    expect(inFight).toContain("[[FIGHT ");
    expect(expandFightHashTags("see #FIGHT[12]#", context, macroses, new Map())).toContain(
      "[[FIGHT ",
    );
  });

  it("builds hunt fight title and money macro without fallbacks", () => {
    expect(huntFightTitle("Ann", "Грызль")).toBe("Нападение Ann на Грызль");
    const fight = buildFightMacro({
      fightId: "12",
      areaId: "503",
      areaTitle: "Радвей",
      fightTitle: huntFightTitle("Ann", "Грызль"),
    });
    expect(fight.macro.area_id).toBe(503);
    expect(fight.macro.fight_title).toBe("Нападение Ann на Грызль");
    const money = buildMoneyMacro(0.2, "1");
    expect(money.macro.amount).toBe("0.2");
    expect(money.token).toMatch(/^\[\[MONEY /);
  });

  it("expands /emo with USER macros and reports a missing target", () => {
    const parsed = parseEmoCommand("/emo привет Bob");
    expect(parsed && "tpl" in parsed).toBe(true);
    const self = buildUserMacro({ nick: "Ann", level: 1, kind: 1 });
    if (!parsed || !("tpl" in parsed)) throw new Error("emo parse");
    expect(expandEmoFlavor(parsed, self, null)).toEqual({ missingTarget: "Bob" });
    const other = buildUserMacro({ nick: "Bob", level: 2, kind: 1 });
    const ok = expandEmoFlavor(parsed, self, other);
    if ("missingTarget" in ok) throw new Error("target should resolve");
    expect(ok.omitFrom).toBe(true);
    expect(ok.msg).toContain(self.token);
    expect(ok.msg).toContain(other.token);
    expect(EMO_TEMPLATES.бой?.all).toContain("{self}");
  });

  it("keeps lone chat|message fragments unmerged", () => {
    expect(isChatOnlyFragment({ "chat|message": { status: 100 } })).toBe(true);
    expect(isChatOnlyFragment({ "chat|message": { status: 100 }, state: {} })).toBe(false);
  });
});
