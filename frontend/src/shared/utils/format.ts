/** Shared formatters — keep locale/currency decisions in one place. */

export function formatDate(value: string | Date, locale = 'en-IN'): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));
}

/** Matches the API's date-only fields, e.g. an academic year's `startDate`. */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formats a calendar date that carries no time or zone.
 *
 * `new Date('2025-04-01')` is parsed as **UTC midnight**, which `Intl` then
 * renders in the viewer's zone — so west of UTC it prints 31 March. The backend
 * deliberately stores these as date-only precisely so "when does the year start"
 * cannot depend on who is asking; formatting them through the local-time path
 * would hand that ambiguity straight back.
 *
 * Constructing from the parts instead pins it to local midnight, so the date
 * shown is always the date stored.
 */
export function formatDateOnly(value: string | Date, locale = 'en-IN'): string {
  if (typeof value === 'string') {
    const match = DATE_ONLY.exec(value);
    if (match) {
      const [, year, month, day] = match;
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
        new Date(Number(year), Number(month) - 1, Number(day)),
      );
    }
  }
  return formatDate(value);
}

export function formatDateTime(value: string | Date, locale = 'en-IN'): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export function formatCurrency(amount: number, currency = 'INR', locale = 'en-IN'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}

export function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

/** Two-letter monogram for avatars. Falls back to '?' rather than rendering blank. */
export function initials(person: { firstName: string; lastName: string }): string {
  const value = `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase();
  return value || '?';
}
