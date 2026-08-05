# todo-api

A small REST API for todos. The point of this project is the **shape**, not the
domain: request validation, a layered structure, domain errors mapped to status
codes in one place, and tests at two levels.

## Run

```bash
npm install
npm test          # 24 tests
npm run dev       # http://localhost:3000
```

## Endpoints

| Method   | Path         | Notes                                     |
| -------- | ------------ | ----------------------------------------- |
| `GET`    | `/health`    | Liveness                                  |
| `GET`    | `/todos`     | `?status=&q=&page=&limit=` — paginated    |
| `GET`    | `/todos/:id` | `404` when unknown                        |
| `POST`   | `/todos`     | `201` with the created todo               |
| `PATCH`  | `/todos/:id` | Partial; rejects an empty body            |
| `DELETE` | `/todos/:id` | `204`                                     |

```bash
curl -X POST localhost:3000/todos -H 'content-type: application/json' \
  -d '{"title":"Write the README","dueDate":"2026-02-01"}'
```

## Structure

```
src/
├── todo.types.ts       Zod schemas — request types are derived from them
├── errors.ts           domain errors that carry their HTTP status
├── todo.repository.ts  storage interface + in-memory implementation
├── todo.service.ts     business rules; knows nothing about HTTP
├── app.ts              routes, and the single error-to-response mapper
└── main.ts             starts the server
```

## Decisions worth noting

**Validation defines the types.** `CreateTodoInput` is `z.infer<>` of the schema
that validates it, so the checks and the types cannot drift apart.

**The service does not import Express.** It takes validated input and throws
domain errors. That is what lets `todo.service.test.ts` run without a server,
and it is why swapping Express for anything else would not touch the rules.

**The repository is an interface.** The in-memory class is one implementation;
a Postgres one would be another, and the service would not change.

**`PATCH` distinguishes absent from null.** Omitting `notes` leaves it alone;
sending `null` clears it. Conflating the two silently destroys data, so there
is a test for each.

**Errors are mapped once.** Zod failures become `400` with the offending fields,
domain errors carry their own status, and anything unrecognised is logged and
reported as `500` without leaking a stack trace.

**The clock is injected.** Tests freeze it rather than sleeping, so timestamp
assertions are exact.

## Tests

Two levels, because they catch different things:

- `todo.service.test.ts` — rules in isolation: partial updates, the null-vs-absent
  distinction, and the pagination edge case where an empty list must still report
  one page rather than zero.
- `todo.api.test.ts` — the wiring, over real HTTP via supertest: status codes,
  validation responses, and a full create → read → update → delete round trip.
