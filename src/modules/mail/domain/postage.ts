export const MAIL_POSTAGE_GOLD = 1;
export const MAIL_MAX_ATTACH = 5;

export function mailTaxRaw(value: number, cod = false): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const raw = Math.pow(0.5, Math.log(value) / Math.LN10 + 2) * value * (cod ? 1.5 : 1);
  if (!Number.isFinite(raw)) throw new Error("Mail tax is not finite");
  return raw;
}

export function mailTax(value: number, cod = false): number {
  return Math.round(mailTaxRaw(value, cod) * 100) / 100;
}
