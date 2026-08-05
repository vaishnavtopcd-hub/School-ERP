import { addDays, daysLate } from '../src/dates';

const DUE = new Date('2026-01-15T12:00:00.000Z');

describe('addDays', () => {
  it('advances by whole days', () => {
    expect(addDays(DUE, 14).toISOString()).toBe('2026-01-29T12:00:00.000Z');
  });

  it('crosses a month boundary', () => {
    expect(addDays(new Date('2026-01-25T00:00:00.000Z'), 10).toISOString()).toBe(
      '2026-02-04T00:00:00.000Z',
    );
  });

  it('does not mutate its argument', () => {
    const original = new Date(DUE);
    addDays(DUE, 5);
    expect(DUE).toEqual(original);
  });
});

describe('daysLate', () => {
  it('is zero when returned early', () => {
    expect(daysLate(DUE, new Date('2026-01-14T12:00:00.000Z'))).toBe(0);
  });

  it('is zero when returned exactly on time', () => {
    expect(daysLate(DUE, DUE)).toBe(0);
  });

  it('counts a part day as a whole day', () => {
    // Two hours late is one day late, not zero — fines are per started day.
    expect(daysLate(DUE, new Date('2026-01-15T14:00:00.000Z'))).toBe(1);
  });

  it('counts exactly one day', () => {
    expect(daysLate(DUE, new Date('2026-01-16T12:00:00.000Z'))).toBe(1);
  });

  it('counts a day and a minute as two days', () => {
    expect(daysLate(DUE, new Date('2026-01-16T12:01:00.000Z'))).toBe(2);
  });

  it('counts a long overrun', () => {
    expect(daysLate(DUE, new Date('2026-02-04T12:00:00.000Z'))).toBe(20);
  });
});
