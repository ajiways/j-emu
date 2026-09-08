import {
  BOOTSTRAP_CHROME_REQUIRED_KEYS,
  type BootstrapChromeDocument,
} from "../../content/domain/bootstrap-content.ts";

export class BootstrapChrome {
  readonly blocks: BootstrapChromeDocument;

  constructor(
    raw: Readonly<Record<string, unknown>>,
    readonly welcomeTemplate: string,
  ) {
    const blocks: Record<string, unknown> = {};
    for (const key of BOOTSTRAP_CHROME_REQUIRED_KEYS) {
      if (!(key in raw)) throw new Error(`Bootstrap chrome is missing ${key}`);
      blocks[key] = raw[key];
    }
    this.blocks = requiredChrome(blocks);
    if (!welcomeTemplate) throw new Error("Welcome template is required");
    if (!welcomeTemplate.includes("{nick}")) {
      throw new Error("Welcome template must contain {nick}");
    }
  }

  block(key: (typeof BOOTSTRAP_CHROME_REQUIRED_KEYS)[number]): unknown {
    if (!(key in this.blocks)) throw new Error(`Bootstrap chrome is missing ${key}`);
    return this.blocks[key];
  }
}

function requiredChrome(blocks: Readonly<Record<string, unknown>>): BootstrapChromeDocument {
  for (const key of BOOTSTRAP_CHROME_REQUIRED_KEYS) {
    if (!(key in blocks)) throw new Error(`Bootstrap chrome is missing ${key}`);
  }
  return blocks as BootstrapChromeDocument;
}
