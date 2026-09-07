export interface Clock {
  now(): Date;
  unixSeconds(): number;
}
