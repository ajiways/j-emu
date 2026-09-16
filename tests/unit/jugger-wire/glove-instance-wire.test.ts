import { describe, expect, it } from "vitest";
import { ArtifactExtra } from "../../../src/modules/catalog/domain/artifact-extra.ts";
import { gloveInstanceFromCatalog } from "../../../src/modules/jugger-wire/application/glove-instance-wire.ts";
import { userMagicFromEquipped } from "../../../src/modules/jugger-wire/application/user-magic-block.ts";
import { testArtifact } from "../../support/artifact-fixtures.ts";

const HITS = [2, 3, 2, 3, 1, 2, 3, 1] as const;

describe("glove instance wire", () => {
  it("expands catalog sockets into dump-shaped spell cards", async () => {
    const glove = testArtifact({
      extra: new ArtifactExtra(
        null,
        [{ cost: 2, row: 1, artikulId0: 9098 }],
        [...HITS],
        null,
        0,
        0,
        0,
      ),
    });
    const spell = testArtifact({
      id: 9098,
      title: "Разряд молнии",
      picture: "electro_ball1.png",
      kindId: 65,
      slotMask: 0,
      extra: new ArtifactExtra(null, [], null, null, 0, 0, 0),
    });
    const catalog = {
      artifact: async (id: number) => {
        if (id === 9095) return glove;
        if (id === 9098) return spell;
        return null;
      },
    };
    await expect(gloveInstanceFromCatalog(glove, catalog)).resolves.toEqual({
      hits: [...HITS],
      spells: [
        {
          id: 9098,
          artikul_id: 9098,
          title: "Разряд молнии",
          picture: "electro_ball1.png",
          description: "",
          quality: 0,
          row: 1,
          cost: 2,
        },
      ],
    });
  });

  it("returns null when catalog sockets are empty", async () => {
    await expect(
      gloveInstanceFromCatalog(testArtifact(), { artifact: async () => null }),
    ).resolves.toBeNull();
  });

  it("fails fast when sockets exist without extra.hits", async () => {
    const glove = testArtifact({
      extra: new ArtifactExtra(null, [{ cost: 2, row: 1, artikulId0: 9098 }], null, null, 0, 0, 0),
    });
    await expect(gloveInstanceFromCatalog(glove, { artifact: async () => null })).rejects.toThrow(
      "Glove artifact 9095 is missing extra.hits",
    );
  });

  it("fails fast when a socket spell is missing from catalog", async () => {
    const glove = testArtifact({
      extra: new ArtifactExtra(
        null,
        [{ cost: 2, row: 1, artikulId0: 9098 }],
        [...HITS],
        null,
        0,
        0,
        0,
      ),
    });
    await expect(gloveInstanceFromCatalog(glove, { artifact: async () => null })).rejects.toThrow(
      "Glove spell 9098 is missing",
    );
  });

  it("keeps user|magic gloves empty without equipped hits/spells", () => {
    expect(userMagicFromEquipped([])).toEqual({ status: 100, gloves: [] });
  });
});
