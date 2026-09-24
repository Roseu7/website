export function hasLegalConsent(value: unknown): boolean {
  return value === true || value === "yes" ||
    (Array.isArray(value) && value.length === 1 && value[0] === "yes");
}

export function hasFormLegalConsent(form: FormData): boolean {
  return hasLegalConsent(form.getAll("legalConsent"));
}
