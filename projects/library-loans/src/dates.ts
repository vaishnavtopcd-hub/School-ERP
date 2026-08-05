const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/**
 * Whole days from `from` to `to`, rounded **up**.
 *
 * Fines are charged per started day: a book two hours late is one day late,
 * not zero. Rounding down would make the first day of lateness free, which is
 * not what "per day" means to a librarian.
 */
export function daysLate(dueAt: Date, returnedAt: Date): number {
  const diff = returnedAt.getTime() - dueAt.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / MS_PER_DAY);
}
