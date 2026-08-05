# library-loans

Borrowing rules for a small library, as **pure domain logic** — no HTTP, no
database, no framework. This project exists to show what the other two cannot:
modelling rules and their edge cases, with tests that read as a description of
the policy.

## Run

```bash
npm install
npm test          # 35 tests
```

There is no server to start. The entry point is the `Library` class.

```ts
import { Library } from './src';

const library = new Library();
library.addBook({ id: 'b1', title: 'Domain-Driven Design', totalCopies: 3 });
library.addMember({
  id: 'm1',
  name: 'Asha',
  tier: 'standard',
  suspended: false,
  outstandingFines: 0,
});

const loan = library.borrow('m1', 'b1');
const { fine } = library.returnBook(loan.id);
```

## The rules

| Rule           | Standard | Premium |
| -------------- | -------- | ------- |
| Loan period    | 14 days  | 28 days |
| Books at once  | 3        | 10      |
| Renewals       | 2        | 2       |
| Fine (per day) | 5        | 5       |

Borrowing is refused when the member is suspended, owes 50 or more, is at their
limit, already holds that title, or every copy is out.

## Decisions worth noting

**The rules live in `LoanPolicy`, not in the code.** Changing "standard members
get 14 days" is one line rather than a hunt for scattered literals — and the
tests assert against the policy object, so they do not silently encode a
duplicate copy of the number.

**Renewal extends from today, not from the old due date.** Extending from the
due date would let someone renew a month late and still receive a full fresh
period. That is not a renewal, it is a retroactive excuse.

**A reservation blocks renewal by anyone else.** Without that, a holder could
renew indefinitely and the queue would never move.

**Late fees round up.** Two hours late is one day late — fines are charged per
*started* day, which is what "per day" means to a librarian. Rounding down
would make the first day free.

**Errors carry a machine-readable `reason`.** A caller branches on
`RENEWAL_LIMIT_REACHED`, never on message text, so wording can change without
breaking anyone.

**The clock is injected.** Every test moves time by hand, so a fourteen-day loan
period is verified in milliseconds and the date assertions are exact.

## Tests

The suite is written as the policy, one rule per case:

- `dates.test.ts` — the rounding rule, checked at each boundary: early, exactly
  on time, two hours late, exactly one day, and one day plus a minute.
- `library.test.ts` — every refusal reason, the fine threshold checked both at
  and just below the limit, that a fine actually lands on the member's balance
  rather than only being reported, and that a returned book stops being overdue
  however late it was.
