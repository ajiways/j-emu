import fs from "node:fs";
import path from "node:path";
import { packageRootFromModule } from "../../../../infrastructure/load-package-env.ts";

export class HtmlView {
  constructor(private readonly directory: string) {
    if (!fs.existsSync(directory)) {
      throw new Error(`HTML view directory does not exist: ${directory}`);
    }
  }

  static fromModule(moduleUrl: string): HtmlView {
    return new HtmlView(
      path.join(
        packageRootFromModule(moduleUrl),
        "src/modules/jugger-wire/infrastructure/http/views",
      ),
    );
  }

  render(name: string, values: Readonly<Record<string, string>>): string {
    const filePath = path.join(this.directory, `${name}.html`);
    if (!fs.existsSync(filePath)) throw new Error(`HTML view is missing: ${filePath}`);
    let html = fs.readFileSync(filePath, "utf8");
    html = html.replaceAll(/\{\{\{\s*([a-zA-Z0-9_]+)\s*\}\}\}/g, (_match, key: string) => {
      const value = values[key];
      if (value === undefined) throw new Error(`HTML view ${name} is missing {{{${key}}}}`);
      return value;
    });
    return html.replaceAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
      const value = values[key];
      if (value === undefined) throw new Error(`HTML view ${name} is missing {{${key}}}`);
      return escapeHtml(value);
    });
  }

  errorMarkup(message: string): string {
    if (message === "") return "";
    return `<p class="err">${escapeHtml(message)}</p>`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
