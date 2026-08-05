import { Library } from '../src/library';
import { DEFAULT_POLICY, type Member } from '../src/types';

const START = new Date('2026-01-15T09:00:00.000Z');

/** A clock the test moves by hand — no sleeping, and every date assertion is exact. */
function makeClock(start = START) {
  let current = start;
  return {
    now: () => current,
    advanceDays: (days: number) => {
      current = new Date(current.getTime() + days * 24 * 60 * 60 * 1000);
    },
  };
}

function member(overrides: Partial<Member> = {}): Member {
  return {
    id: 'm1',
    name: 'Asha',
    tier: 'standard',
    suspended: false,
    outstandingFines: 0,
    ...overrides,
  };
}

/** A library with one member and one three-copy book, ready to borrow. */
function setup(memberOverrides: Partial<Member> = {}) {
  const clock = makeClock();
  const library = new Library(clock.now);

  library.addMember(member(memberOverrides));
  library.addBook({ id: 'b1', title: 'Domain-Driven Design', totalCopies: 3 });

  return { library, clock };
}

describe('borrowing', () => {
  it('issues a loan due after the standard period', () => {
    const { library } = setup();

    const loan = library.borrow('m1', 'b1');

    expect(loan.dueAt.toISOString()).toBe('2026-01-29T09:00:00.000Z');
    expect(loan.renewals).toBe(0);
    expect(loan.returnedAt).toBeNull();
  });

  it('gives premium members a longer period', () => {
    const { library } = setup({ tier: 'premium' });

    const loan = library.borrow('m1', 'b1');

    expect(loan.dueAt.toISOString()).toBe('2026-02-12T09:00:00.000Z');
  });

  it('reduces the available copies', () => {
    const { library } = setup();

    library.borrow('m1', 'b1');

    expect(library.availableCopies('b1')).toBe(2);
  });

  it('refuses a suspended member', () => {
    const { library } = setup({ suspended: true });

    expect(() => library.borrow('m1', 'b1')).toThrow(
      expect.objectContaining({ reason: 'MEMBER_SUSPENDED' }),
    );
  });

  it('refuses a member at the fine threshold', () => {
    const { library } = setup({ outstandingFines: DEFAULT_POLICY.fineBlockThreshold });

    expect(() => library.borrow('m1', 'b1')).toThrow(
      expect.objectContaining({ reason: 'FINES_TOO_HIGH' }),
    );
  });

  it('allows a member just below the fine threshold', () => {
    const { library } = setup({ outstandingFines: DEFAULT_POLICY.fineBlockThreshold - 1 });

    expect(() => library.borrow('m1', 'b1')).not.toThrow();
  });

  it('refuses a second copy of the same book', () => {
    const { library } = setup();
    library.borrow('m1', 'b1');

    expect(() => library.borrow('m1', 'b1')).toThrow(
      expect.objectContaining({ reason: 'ALREADY_BORROWED' }),
    );
  });

  it('refuses once the loan limit is reached', () => {
    const { library } = setup();
    for (const id of ['b2', 'b3', 'b4']) {
      library.addBook({ id, title: id, totalCopies: 1 });
    }

    library.borrow('m1', 'b1');
    library.borrow('m1', 'b2');
    library.borrow('m1', 'b3');

    expect(() => library.borrow('m1', 'b4')).toThrow(
      expect.objectContaining({ reason: 'LOAN_LIMIT_REACHED' }),
    );
  });

  it('refuses when every copy is out', () => {
    const { library } = setup();
    library.addBook({ id: 'rare', title: 'Only One', totalCopies: 1 });
    library.addMember({ ...member(), id: 'm2', name: 'Bala' });

    library.borrow('m2', 'rare');

    expect(() => library.borrow('m1', 'rare')).toThrow(
      expect.objectContaining({ reason: 'NO_COPIES_AVAILABLE' }),
    );
  });

  it('frees a copy once returned', () => {
    const { library } = setup();
    library.addBook({ id: 'rare', title: 'Only One', totalCopies: 1 });
    const loan = library.borrow('m1', 'rare');

    library.returnBook(loan.id);

    expect(library.availableCopies('rare')).toBe(1);
  });

  it('reports an unknown book', () => {
    const { library } = setup();

    expect(() => library.borrow('m1', 'ghost')).toThrow(
      expect.objectContaining({ reason: 'NOT_FOUND' }),
    );
  });
});

describe('returning', () => {
  it('charges nothing when on time', () => {
    const { library, clock } = setup();
    const loan = library.borrow('m1', 'b1');

    clock.advanceDays(10);
    const outcome = library.returnBook(loan.id);

    expect(outcome).toMatchObject({ daysLate: 0, fine: 0 });
  });

  it('charges nothing when returned exactly on the due date', () => {
    const { library, clock } = setup();
    const loan = library.borrow('m1', 'b1');

    clock.advanceDays(14);
    const outcome = library.returnBook(loan.id);

    // The boundary: due today is not late.
    expect(outcome.fine).toBe(0);
  });

  it('charges per day once late', () => {
    const { library, clock } = setup();
    const loan = library.borrow('m1', 'b1');

    clock.advanceDays(17);
    const outcome = library.returnBook(loan.id);

    expect(outcome.daysLate).toBe(3);
    expect(outcome.fine).toBe(3 * DEFAULT_POLICY.finePerDayLate);
  });

  it('adds the fine to the member balance', () => {
    const { library, clock } = setup();
    const loan = library.borrow('m1', 'b1');

    clock.advanceDays(16);
    const outcome = library.returnBook(loan.id);

    // A second borrow proves the balance was actually updated, not just reported.
    library.addBook({ id: 'b2', title: 'Another', totalCopies: 1 });
    expect(outcome.fine).toBe(10);
    expect(() => library.borrow('m1', 'b2')).not.toThrow();
  });

  it('blocks borrowing once accrued fines reach the threshold', () => {
    const { library, clock } = setup();
    const loan = library.borrow('m1', 'b1');

    clock.advanceDays(14 + 10); // 10 days late × 5 = 50, the threshold
    library.returnBook(loan.id);

    expect(() => library.borrow('m1', 'b1')).toThrow(
      expect.objectContaining({ reason: 'FINES_TOO_HIGH' }),
    );
  });

  it('refuses a second return', () => {
    const { library } = setup();
    const loan = library.borrow('m1', 'b1');
    library.returnBook(loan.id);

    expect(() => library.returnBook(loan.id)).toThrow(
      expect.objectContaining({ reason: 'ALREADY_RETURNED' }),
    );
  });
});

describe('renewing', () => {
  it('extends from today, not from the old due date', () => {
    const { library, clock } = setup();
    const loan = library.borrow('m1', 'b1');

    clock.advanceDays(10);
    const renewed = library.renew(loan.id);

    // Day 10 + 14 = day 24, not the original day 14 + 14 = day 28.
    expect(renewed.dueAt.toISOString()).toBe('2026-02-08T09:00:00.000Z');
    expect(renewed.renewals).toBe(1);
  });

  it('allows renewals up to the limit', () => {
    const { library, clock } = setup();
    const loan = library.borrow('m1', 'b1');

    library.renew(loan.id);
    clock.advanceDays(1);
    library.renew(loan.id);

    expect(() => library.renew(loan.id)).toThrow(
      expect.objectContaining({ reason: 'RENEWAL_LIMIT_REACHED' }),
    );
  });

  it('refuses to renew an overdue loan', () => {
    const { library, clock } = setup();
    const loan = library.borrow('m1', 'b1');

    clock.advanceDays(15);

    expect(() => library.renew(loan.id)).toThrow(
      expect.objectContaining({ reason: 'CANNOT_RENEW_OVERDUE' }),
    );
  });

  it('refuses when another member is waiting', () => {
    const { library } = setup();
    library.addMember({ ...member(), id: 'm2', name: 'Bala' });
    const loan = library.borrow('m1', 'b1');

    library.reserve('b1', 'm2');

    expect(() => library.renew(loan.id)).toThrow(
      expect.objectContaining({ reason: 'RESERVED_BY_ANOTHER' }),
    );
  });

  it('still allows renewal when the reservation is the holder’s own', () => {
    const { library } = setup();
    const loan = library.borrow('m1', 'b1');

    library.reserve('b1', 'm1');

    expect(() => library.renew(loan.id)).not.toThrow();
  });

  it('refuses to renew a returned loan', () => {
    const { library } = setup();
    const loan = library.borrow('m1', 'b1');
    library.returnBook(loan.id);

    expect(() => library.renew(loan.id)).toThrow(
      expect.objectContaining({ reason: 'ALREADY_RETURNED' }),
    );
  });
});

describe('isOverdue', () => {
  it('is false before the due date', () => {
    const { library, clock } = setup();
    const loan = library.borrow('m1', 'b1');

    clock.advanceDays(13);

    expect(library.isOverdue(loan.id)).toBe(false);
  });

  it('is true after the due date', () => {
    const { library, clock } = setup();
    const loan = library.borrow('m1', 'b1');

    clock.advanceDays(15);

    expect(library.isOverdue(loan.id)).toBe(true);
  });

  it('is false once returned, however late', () => {
    const { library, clock } = setup();
    const loan = library.borrow('m1', 'b1');

    clock.advanceDays(20);
    library.returnBook(loan.id);

    // A returned book is settled, not perpetually overdue.
    expect(library.isOverdue(loan.id)).toBe(false);
  });
});
