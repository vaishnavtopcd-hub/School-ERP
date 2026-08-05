export type MemberTier = 'standard' | 'premium';

export interface Member {
  id: string;
  name: string;
  tier: MemberTier;
  /** Suspended members may return and pay, but not borrow. */
  suspended: boolean;
  /** Accrued fines in whole currency units. */
  outstandingFines: number;
}

export interface Book {
  id: string;
  title: string;
  totalCopies: number;
}

export interface Loan {
  id: string;
  bookId: string;
  memberId: string;
  borrowedAt: Date;
  dueAt: Date;
  returnedAt: Date | null;
  /** How many times this loan has been renewed. */
  renewals: number;
}

/**
 * The rules, in one place and named.
 *
 * Keeping them in a single object rather than scattering literals through the
 * code is what makes "premium members get 28 days" a one-line change instead
 * of a search-and-replace.
 */
export interface LoanPolicy {
  loanDays: Record<MemberTier, number>;
  maxActiveLoans: Record<MemberTier, number>;
  maxRenewals: number;
  finePerDayLate: number;
  /** At or above this, borrowing is blocked until the balance is cleared. */
  fineBlockThreshold: number;
}

export const DEFAULT_POLICY: LoanPolicy = {
  loanDays: { standard: 14, premium: 28 },
  maxActiveLoans: { standard: 3, premium: 10 },
  maxRenewals: 2,
  finePerDayLate: 5,
  fineBlockThreshold: 50,
};

/** Thrown when a rule refuses an action. The `reason` is machine-readable so a
 *  caller can branch on it without matching on message text. */
export class LoanError extends Error {
  constructor(
    readonly reason:
      | 'MEMBER_SUSPENDED'
      | 'FINES_TOO_HIGH'
      | 'LOAN_LIMIT_REACHED'
      | 'NO_COPIES_AVAILABLE'
      | 'ALREADY_BORROWED'
      | 'ALREADY_RETURNED'
      | 'RENEWAL_LIMIT_REACHED'
      | 'CANNOT_RENEW_OVERDUE'
      | 'RESERVED_BY_ANOTHER'
      | 'NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'LoanError';
  }
}
