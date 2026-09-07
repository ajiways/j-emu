import type { Account } from "../../../identity/domain/account.ts";
import { buildFlashVars } from "./flash-vars.ts";
import { HtmlView } from "./html-view.ts";

export class AuthHtmlPages {
  constructor(private readonly views: HtmlView) {}

  static fromModule(moduleUrl: string): AuthHtmlPages {
    return new AuthHtmlPages(HtmlView.fromModule(moduleUrl));
  }

  login(error = ""): string {
    return this.views.render("login", { errorBlock: this.views.errorMarkup(error) });
  }

  register(error = ""): string {
    return this.views.render("register", { errorBlock: this.views.errorMarkup(error) });
  }

  game(account: Account): string {
    return this.views.render("game", {
      flashvars: buildFlashVars({ id: account.id, nick: account.nick }),
      nickJs: JSON.stringify(account.nick),
      idJs: JSON.stringify(String(account.id)),
    });
  }
}
