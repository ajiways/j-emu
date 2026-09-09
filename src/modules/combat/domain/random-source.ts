export interface RandomSource {
  integer(minInclusive: number, maxInclusive: number): number;
  unit(): number;
}
