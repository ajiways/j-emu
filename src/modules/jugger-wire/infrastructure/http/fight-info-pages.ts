import type { FightInfoCard, FightInfoMember } from "../../../combat/domain/fight-info-card.ts";
import { HtmlView } from "./html-view.ts";

export class FightInfoPages {
  constructor(private readonly views: HtmlView) {}

  static fromModule(moduleUrl: string): FightInfoPages {
    return new FightInfoPages(HtmlView.fromModule(moduleUrl));
  }

  invalid(): string {
    return this.views.render("fight_info", {
      pageTitle: "Информация о бое",
      title: "Бой не найден",
      statusLine: "Некорректный fight_id.",
      teamsHtml: "",
    });
  }

  missing(fightId: string): string {
    return this.views.render("fight_info", {
      pageTitle: "Информация о бое",
      title: `Бой #${fightId}`,
      statusLine: "Бой не найден",
      teamsHtml: "",
    });
  }

  card(info: FightInfoCard): string {
    const winner = info.winner === undefined ? "" : ` Победила команда ${info.winner}.`;
    return this.views.render("fight_info", {
      pageTitle: `${info.title} - информация о бое`,
      title: info.title,
      statusLine: `${info.live ? "Идёт сейчас" : "Завершён"}. Тип ${info.type}. Начат ${info.started}. ${info.duration} с.${winner}`,
      teamsHtml: `${teamBlock("Команда 1", info.teams["1"])}${teamBlock("Команда 2", info.teams["2"])}`,
    });
  }
}

function teamBlock(label: string, members: readonly FightInfoMember[]): string {
  const rows = members
    .map(
      (member) =>
        `<li>${escapeHtml(member.nick)} (${escapeHtml(member.level)})${member.bot === 1 ? " бот" : ""}</li>`,
    )
    .join("");
  return `<div class="team"><h2>${escapeHtml(label)}</h2><ul>${rows}</ul></div>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
