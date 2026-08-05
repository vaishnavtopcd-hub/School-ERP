import { addDays, daysLate } from './dates';
import {
  type Book,
  DEFAULT_POLICY,
  type Loan,
  LoanError,
  type LoanPolicy,
  type Member,
} from './types';

export interface ReturnOutcome {
  loan: Loan;
  daysLate: number;
  fine: number;
}

/**
 * Borrowing rules for a small library.
 *
 * Deliberately framework-free: no HTTP, no database, no ORM. Everything is a
 * method on in-memory state with an injected clock, which means the tests read
 * as a description of the rules rather than as setup for a server.
 *
 * The rules themselves live in `LoanPolicy`, so changing "standard members get
 * 14 days" is one line rather than a hunt through the code.
 */
export class Library {
  private readonly books = new Map<string, Book>();
  private readonly members = new Map<string, Member>();
  private readonly loans = new Map<string, Loan>();
  /** bookId → memberId waiting for it. */
  private readonly reservations = new Map<string, string>();

  /** Per instance, not module-level: two libraries must not share a counter. */
  private nextLoanId = 1;

  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly policy: LoanPolicy = DEFAULT_POLICY,
  ) {}

  addBook(book: Book): void {
    this.books.set(book.id, book);
  }

  addMember(member: Member): void {
    this.members.set(member.id, member);
  }

  /** Records that `memberId` is waiting for a book, which blocks renewals by
   *  anyone else — otherwise a holder could renew indefinitely and the queue
   *  would never move. */
  reserve(bookId: string, memberId: string): void {
    this.getBook(bookId);
    this.getMember(memberId);
    this.reservations.set(bookId, memberId);
  }

  activeLoansOf(memberId: string): Loan[] {
    return [...this.loans.values()].filter(
      (loan) => loan.memberId === memberId && loan.returnedAt === null,
    );
  }

  availableCopies(bookId: string): number {
    const book = this.getBook(bookId);
    const onLoan = [...this.loans.values()].filter(
      (loan) => loan.bookId === bookId && loan.returnedAt === null,
    ).length;

    return book.totalCopies - onLoan;
  }

  borrow(memberId: string, bookId: string): Loan {
    const member = this.getMember(memberId);
    this.getBook(bookId);

    if (member.suspended) {
      throw new LoanError('MEMBER_SUSPENDED', `${member.name} is suspended and cannot borrow.`);
    }

    if (member.outstandingFines >= this.policy.fineBlockThreshold) {
      throw new LoanError(
        'FINES_TOO_HIGH',
        `${member.name} owes ${member.outstandingFines}; clear it to borrow again.`,
      );
    }

    const active = this.activeLoansOf(memberId);

    if (active.length >= this.policy.maxActiveLoans[member.tier]) {
      throw new LoanError(
        'LOAN_LIMIT_REACHED',
        `${member.name} already has ${active.length} books out.`,
      );
    }

    // One copy per member: a second copy of the same title helps nobody, and
    // it would make "return this book" ambiguous.
    if (active.some((loan) => loan.bookId === bookId)) {
      throw new LoanError('ALREADY_BORROWED', 'This member already has a copy of that book.');
    }

    if (this.availableCopies(bookId) <= 0) {
      throw new LoanError('NO_COPIES_AVAILABLE', 'Every copy is on loan.');
    }

    const borrowedAt = this.now();
    const loan: Loan = {
      id: `loan-${this.nextLoanId++}`,
      bookId,
      memberId,
      borrowedAt,
      dueAt: addDays(borrowedAt, this.policy.loanDays[member.tier]),
      returnedAt: null,
      renewals: 0,
    };

    this.loans.set(loan.id, loan);

    // Borrowing the reserved copy clears the reservation — the wait is over.
    if (this.reservations.get(bookId) === memberId) {
      this.reservations.delete(bookId);
    }

    return loan;
  }

  /** Returns the loan plus what it cost. The fine is added to the member's
   *  balance here so the two can never disagree. */
  returnBook(loanId: string): ReturnOutcome {
    const loan = this.getLoan(loanId);

    if (loan.returnedAt !== null) {
      throw new LoanError('ALREADY_RETURNED', 'That loan was already returned.');
    }

    const returnedAt = this.now();
    const late = daysLate(loan.dueAt, returnedAt);
    const fine = late * this.policy.finePerDayLate;

    loan.returnedAt = returnedAt;

    if (fine > 0) {
      const member = this.getMember(loan.memberId);
      member.outstandingFines += fine;
    }

    return { loan, daysLate: late, fine };
  }

  /**
   * Extends a loan from **today**, not from the old due date.
   *
   * Extending from the due date would let someone renew a month late and still
   * get a full fresh period, which is not a renewal — it is a retroactive
   * excuse. Overdue loans cannot be renewed at all.
   */
  renew(loanId: string): Loan {
    const loan = this.getLoan(loanId);

    if (loan.returnedAt !== null) {
      throw new LoanError('ALREADY_RETURNED', 'That loan was already returned.');
    }

    if (loan.renewals >= this.policy.maxRenewals) {
      throw new LoanError(
        'RENEWAL_LIMIT_REACHED',
        `A loan can be renewed ${this.policy.maxRenewals} times.`,
      );
    }

    const reservedBy = this.reservations.get(loan.bookId);
    if (reservedBy !== undefined && reservedBy !== loan.memberId) {
      throw new LoanError('RESERVED_BY_ANOTHER', 'Someone else is waiting for this book.');
    }

    const today = this.now();
    if (today.getTime() > loan.dueAt.getTime()) {
      throw new LoanError('CANNOT_RENEW_OVERDUE', 'This loan is overdue; return it first.');
    }

    loan.dueAt = addDays(today, this.policy.loanDays[this.getMember(loan.memberId).tier]);
    loan.renewals += 1;

    return loan;
  }

  isOverdue(loanId: string): boolean {
    const loan = this.getLoan(loanId);
    if (loan.returnedAt !== null) return false;
    return this.now().getTime() > loan.dueAt.getTime();
  }

  // -------------------------------------------------------------------------

  private getBook(id: string): Book {
    const book = this.books.get(id);
    if (!book) throw new LoanError('NOT_FOUND', `No book with id "${id}"`);
    return book;
  }

  private getMember(id: string): Member {
    const member = this.members.get(id);
    if (!member) throw new LoanError('NOT_FOUND', `No member with id "${id}"`);
    return member;
  }

  private getLoan(id: string): Loan {
    const loan = this.loans.get(id);
    if (!loan) throw new LoanError('NOT_FOUND', `No loan with id "${id}"`);
    return loan;
  }
}
