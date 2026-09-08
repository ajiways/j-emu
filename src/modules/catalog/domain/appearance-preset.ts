export class AppearancePreset {
  constructor(
    readonly kind: number,
    readonly gender: number,
    readonly avatarBig: string,
    readonly avatarSmall: string,
  ) {
    if (kind < 1 || gender < 1) throw new Error("Appearance kind and gender must be positive");
    if (!avatarBig) throw new Error("Appearance avatar_big is required");
    if (!avatarSmall) throw new Error("Appearance avatar_small is required");
  }
}
