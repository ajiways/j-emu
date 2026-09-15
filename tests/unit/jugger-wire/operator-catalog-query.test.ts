import { describe, expect, it } from "vitest";
import { CatalogOperatorError } from "../../../src/modules/jugger-wire/application/catalog-operator-error.ts";
import {
  parseArtifactId,
  parseCatalogListQuery,
} from "../../../src/modules/jugger-wire/infrastructure/http/operator-catalog-query.ts";

describe("operator catalog query", () => {
  it("parses search text and id lists", () => {
    expect(parseCatalogListQuery({ q: "мясо" })).toEqual({ q: "мясо" });
    expect(parseCatalogListQuery({ ids: "77,20" })).toEqual({ ids: [77, 20] });
    expect(parseCatalogListQuery({})).toEqual({});
  });

  it("rejects unknown fields, combined q+ids, and invalid ids", () => {
    expect(() => parseCatalogListQuery({ extra: "1" })).toThrow(CatalogOperatorError);
    expect(() => parseCatalogListQuery({ q: "a", ids: "77" })).toThrow(/cannot be combined/);
    expect(() => parseCatalogListQuery({ ids: "0" })).toThrow(/artifact id is invalid/);
    expect(() => parseCatalogListQuery({ ids: "" })).toThrow(/comma-separated/);
    expect(() => parseArtifactId("0")).toThrow(/artifact id is invalid/);
  });
});
