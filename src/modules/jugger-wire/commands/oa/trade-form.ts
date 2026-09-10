export function formNick(form: Readonly<Record<string, unknown>> | undefined): string {
  const raw = form ? form["nick"] : undefined;
  return typeof raw === "string" ? raw : "";
}

export function formTrayId(form: Readonly<Record<string, unknown>> | undefined): number {
  const raw = formField(form, "tray_id", "trayId");
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return 0;
  return n;
}

export function formOptionalTrayId(
  form: Readonly<Record<string, unknown>> | undefined,
): number | null {
  const raw = formField(form, "tray_id", "trayId");
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

export function formItemId(form: Readonly<Record<string, unknown>> | undefined): number {
  const raw = formField(form, "item", "artifact");
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return 0;
  return n;
}

export function formPutAmount(form: Readonly<Record<string, unknown>> | undefined): number {
  const raw = form ? form["amount"] : undefined;
  if (raw === undefined || raw === null || raw === "") return 1;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export function formMoneyAmount(form: Readonly<Record<string, unknown>> | undefined): number {
  const raw = form ? form["amount"] : undefined;
  return Number(raw);
}

export function formConfirmKey(form: Readonly<Record<string, unknown>> | undefined): string {
  const raw = form ? form["confirm_key"] : undefined;
  return typeof raw === "string" ? raw : "";
}

function formField(
  form: Readonly<Record<string, unknown>> | undefined,
  primary: string,
  alias: string,
): unknown {
  if (!form) return undefined;
  if (form[primary] !== undefined) return form[primary];
  return form[alias];
}
