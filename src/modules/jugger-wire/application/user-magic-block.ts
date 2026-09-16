import type { EquippedArtifactBlock } from "./equipped-artifact-block.ts";

export type UserMagicBlock = Readonly<{
  status: 100;
  gloves: readonly EquippedArtifactBlock[];
}>;

export function userMagicFromEquipped(artifacts: readonly EquippedArtifactBlock[]): UserMagicBlock {
  return {
    status: 100,
    gloves: artifacts.filter(
      (artifact) => artifact.hits !== undefined && artifact.spells !== undefined,
    ),
  };
}
