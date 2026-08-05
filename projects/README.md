# Sample projects

Three small, self-contained projects, kept deliberately standard so the code is
the only thing to look at. Each is independent — its own `package.json`, its own
tests, no dependency on the ERP in the parent directory or on each other.

The main application in this repository is a school ERP; it is a large system
and takes a while to read. These are the ten-minute version.

| Project                            | Shows                                                    | Tests |
| ---------------------------------- | -------------------------------------------------------- | ----- |
| [todo-api](todo-api/)              | REST CRUD, validation, layering, two levels of testing    | 24    |
| [url-shortener](url-shortener/)    | An encoding algorithm, HTTP semantics, expiry, time tests | 41    |
| [library-loans](library-loans/)    | Domain rules and edge cases, no framework at all          | 35    |

**100 tests in total.** Every project runs the same three commands:

```bash
npm install
npm test
npm run typecheck
```

`todo-api` and `url-shortener` also have `npm run dev`; `library-loans` is a
library, so it has no server to start.

## Why these three

They were chosen to *not* overlap.

**[todo-api](todo-api/)** is the conventional one: a layered REST service where
validation defines the types, the service layer never imports Express, and
storage sits behind an interface. It is the shape most backend work takes.

**[url-shortener](url-shortener/)** has an actual decision in it — encoding a
counter in base62 rather than hashing the URL, so codes are unique by
construction with no collision handling. It is also where the HTTP details
matter: `302` rather than `301` so hit counting keeps working, `410` rather
than `404` for a link that expired.

**[library-loans](library-loans/)** deliberately has no framework, no HTTP, and
no database — just rules and their edge cases. Renewal extends from today
rather than from the old due date; a reservation blocks someone else's renewal;
fines round up because a part day is a started day. The tests read as the
policy.

## Conventions across all three

- **TypeScript in `strict` mode**, plus `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes` — the settings that catch real mistakes rather
  than only the obvious ones.
- **The clock is injected everywhere.** No test sleeps; a fourteen-day loan
  period and a sixty-second link expiry are both verified in milliseconds, and
  every date assertion is exact.
- **Errors carry a machine-readable code**, so callers branch on the code and
  never on message text.
- **Comments explain *why*, not *what*.** Where there is a boundary case or a
  choice between two defensible options, the reasoning is in the file.

## What these are not

Small samples, honestly scoped. Storage is in-memory in all three, so nothing
survives a restart; there is no authentication, no rate limiting, and no
deployment configuration. Where a shortcut would matter in production — the
sequential, guessable short codes, for instance — the project's own README says
so rather than leaving it to be discovered.

For authentication, RBAC, migrations, structured logging, and Docker packaging,
see [the ERP](../README.md) in the parent directory.
