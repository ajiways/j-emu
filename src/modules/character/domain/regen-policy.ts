export type RegenPolicy = Readonly<{
  k: number;
  /** Seconds-per-point constant of the mana clock: `MPREG / mpK` points a second. */
  mpK: number;
  provenance: "legacy behavior / empirical";
}>;
