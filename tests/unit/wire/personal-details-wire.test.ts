import { describe, expect, it } from "vitest";
import { withHttpsFproxy } from "../../../src/modules/jugger-wire/application/personal-details-wire.ts";

describe("withHttpsFproxy", () => {
  it("forces HTTPS fproxy over a stored zero", () => {
    expect(withHttpsFproxy({ pondViewLast: "0", use_fproxy: 0 })).toEqual({
      pondViewLast: "0",
      use_fproxy: 1,
    });
  });
});
