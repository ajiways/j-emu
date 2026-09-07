import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CommonConfDocument } from "../../../src/modules/jugger-wire/application/common-conf-document.ts";

describe("CommonConfDocument", () => {
  it("loads the playable catalog with live dump keys", () => {
    const conf = CommonConfDocument.load(path.resolve(process.cwd(), "content/common-conf.json"));
    expect(conf.status).toBe(100);
    expect(conf.gag_reason_info).toMatchObject({
      "1": { id: 1, title: "предупреждение", duration: 60 },
    });
    for (const key of CommonConfDocument.requiredKeys) {
      expect(conf).toHaveProperty(key);
    }
  });

  it("fails when the file is missing", () => {
    expect(() =>
      CommonConfDocument.load(path.resolve(os.tmpdir(), "missing-common-conf.json")),
    ).toThrow(/does not exist/);
  });

  it("fails when a required key is missing", () => {
    const file = path.join(os.tmpdir(), `common-conf-missing-${process.pid}.json`);
    fs.writeFileSync(file, JSON.stringify({ status: 100, gag_reason_info: { "1": { id: 1 } } }));
    try {
      expect(() => CommonConfDocument.load(file)).toThrow(/missing keys/);
    } finally {
      fs.unlinkSync(file);
    }
  });
});
