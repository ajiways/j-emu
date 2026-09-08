import path from "node:path";
import { describe, expect, it } from "vitest";
import { COMMON_CONF_REQUIRED_KEYS } from "../../../src/modules/content/domain/bootstrap-content.ts";
import { loadContentBundleFile } from "../../../src/modules/content/infrastructure/load-content-bundle-file.ts";

describe("common conf catalog", () => {
  it("loads the playable catalog with live dump keys", () => {
    const conf = loadContentBundleFile(
      path.resolve(process.cwd(), "content/playable-slice.json"),
    ).commonConf;
    expect(conf.status).toBe(100);
    expect(conf.gag_reason_info).toMatchObject({
      "1": { id: 1, title: "предупреждение", duration: 60 },
    });
    for (const key of COMMON_CONF_REQUIRED_KEYS) {
      expect(conf).toHaveProperty(key);
    }
  });

  it("fails when commonConf and commonConfFile are both missing", () => {
    expect(() => loadContentBundleFile(path.resolve(process.cwd(), "package.json"))).toThrow();
  });
});
