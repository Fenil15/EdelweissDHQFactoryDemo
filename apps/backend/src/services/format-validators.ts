/**
 * Server-side format validators for vendor onboarding fields.
 *
 * Each `isValid…` is a pure predicate. `validateFormatFields` walks the known
 * sections of a submission's `formDataJson` payload and returns a flat
 * `{ field: errorCode }` map for any malformed value. Absent / empty values
 * are treated as "not provided" and never produce an error (drafts are
 * allowed to be partially filled).
 */

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// 2-digit state code + 10-char PAN + entity (1-9 or A-Z) + literal Z + 1 alphanumeric checksum.
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// Indian PIN: 6 digits, leading digit must not be 0.
export const PIN_REGEX = /^[1-9][0-9]{5}$/;

export function isValidPan(value: unknown): boolean {
  return typeof value === 'string' && PAN_REGEX.test(value);
}

export function isValidGstin(value: unknown): boolean {
  return typeof value === 'string' && GSTIN_REGEX.test(value);
}

export function isValidIfsc(value: unknown): boolean {
  return typeof value === 'string' && IFSC_REGEX.test(value);
}

export function isValidPin(value: unknown): boolean {
  return typeof value === 'string' && PIN_REGEX.test(value);
}

export type FormatErrorMap = Record<string, string>;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function readSection(
  data: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> {
  const v = data?.[key];
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

/**
 * Walks the known sections (companyInfo, banking, taxIds, address) and
 * reports any format errors. Returns an empty object when everything is
 * valid (or absent).
 */
export function validateFormatFields(data: Record<string, unknown> | undefined): FormatErrorMap {
  const errors: FormatErrorMap = {};
  const companyInfo = readSection(data, 'companyInfo');
  const banking = readSection(data, 'banking');
  const taxIds = readSection(data, 'taxIds');
  const address = readSection(data, 'address');

  if (isNonEmptyString(companyInfo.panNumber) && !isValidPan(companyInfo.panNumber)) {
    errors.panNumber = 'invalid_pan';
  }
  if (isNonEmptyString(banking.ifsc) && !isValidIfsc(banking.ifsc)) {
    errors.ifsc = 'invalid_ifsc';
  }
  if (isNonEmptyString(taxIds.gstin) && !isValidGstin(taxIds.gstin)) {
    errors.gstin = 'invalid_gstin';
  }
  if (isNonEmptyString(address.pin) && !isValidPin(address.pin)) {
    errors.pin = 'invalid_pin';
  }

  return errors;
}
