/** AS3 ArtifactFlags.ARTIFACT_FLAG_NOWEIGHT */
const ARTIFACT_FLAG_NOWEIGHT = 8;

export function isNoweightFlags(flags: number): boolean {
  if (!Number.isInteger(flags) || flags < 0) {
    throw new Error("Artifact flags are invalid");
  }
  return (flags & ARTIFACT_FLAG_NOWEIGHT) !== 0;
}

export function noweightWire(flags: number): 0 | 1 {
  return isNoweightFlags(flags) ? 1 : 0;
}
