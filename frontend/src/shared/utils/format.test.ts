import { describe, expect, it } from 'vitest';

import { formatDateOnly, initials } from './format';

describe('formatDateOnly', () => {
  /**
   * The regression this exists for: `new Date('2025-04-01')` is UTC midnight,
   * so rendering it in any negative-offset zone yields the *previous* day. The
   * backend stores academic-year bounds as date-only precisely so the answer to
   * "when does the year start" does not depend on the viewer.
   */
  it('renders the stored calendar date, not a timezone-shifted one', () => {
    const stored = '2025-04-01';

    // What the naive path produces west of UTC — the behaviour being avoided.
    const naive = new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeZone: 'America/Los_Angeles',
    }).format(new Date(stored));

    expect(naive).toContain('31 Mar');
    expect(formatDateOnly(stored)).toContain('1 Apr');
    expect(formatDateOnly(stored)).toContain('2025');
  });

  it('handles every month boundary without drifting', () => {
    for (let month = 1; month <= 12; month += 1) {
      const first = `2025-${String(month).padStart(2, '0')}-01`;
      expect(formatDateOnly(first)).toContain('1 ');
      expect(formatDateOnly(first)).toContain('2025');
    }
  });

  it('falls back to full parsing for values carrying a time', () => {
    expect(formatDateOnly('2025-04-01T10:30:00.000Z')).toContain('2025');
  });
});

describe('initials', () => {
  it('builds a two-letter monogram', () => {
    expect(initials({ firstName: 'Asha', lastName: 'Rao' })).toBe('AR');
  });

  it('never renders blank', () => {
    expect(initials({ firstName: '', lastName: '' })).toBe('?');
  });
});
