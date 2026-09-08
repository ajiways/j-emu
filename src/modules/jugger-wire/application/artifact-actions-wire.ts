import type { ArtifactUseAction } from "../../catalog/domain/artifact-use-action.ts";

export type ArtifactActionWireBlock = Readonly<{
  code: string;
  param1: string;
  param2: string;
  dispose: string;
  title: string;
}>;

export function artifactActionsWire(
  useActions: Readonly<Record<string, ArtifactUseAction>>,
): Readonly<Record<string, ArtifactActionWireBlock>> {
  const blocks: Record<string, ArtifactActionWireBlock> = {};
  for (const [key, action] of Object.entries(useActions)) {
    blocks[key] = {
      code: action.code,
      param1: String(action.param1),
      param2: String(action.param2),
      dispose: String(action.dispose),
      title: action.title,
    };
  }
  return blocks;
}
