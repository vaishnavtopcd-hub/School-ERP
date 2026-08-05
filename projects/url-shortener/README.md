# url-shortener

Short links with base62 codes, optional expiry, and hit counting. The
interesting parts are the **encoding choice**, the **status codes**, and what
the tests do with time.

## Run

```bash
npm install
npm test          # 41 tests
npm run dev       # http://localhost:3001
```

## Endpoints

| Method | Path                 | Notes                                        |
| ------ | -------------------- | -------------------------------------------- |
| `POST` | `/links`             | `{ url, ttlSeconds? }` → `201` with the code |
| `GET`  | `/:code`             | `302` to the target, `410` once expired      |
| `GET`  | `/links/:code/stats` | Hits and expiry; does not count as a visit   |

```bash
curl -X POST localhost:3001/links -H 'content-type: application/json' \
  -d '{"url":"https://example.com/a/long/path","ttlSeconds":3600}'
```

## Decisions worth noting

**Counter + base62, not a hash of the URL.** Codes are unique *by construction*,
so there is no collision to detect, no retry loop, and no race between two
writers picking the same code. A hash would need all three.

**302, not 301.** A permanent redirect is cached by the browser, so the next
visit never reaches the server — hit counting would silently stop and an expiry
would never take effect. The temporary redirect keeps both working.

**Expired links answer `410 Gone`, not `404`.** "Existed and lapsed" is
genuinely different information from "never existed", and the record is kept so
`/stats` can still explain what happened.

**Only `http` and `https` are accepted.** Without that check a shortener will
store `javascript:` and `data:` URLs and serve them from a trusted-looking
domain — a ready-made redirect gadget for phishing.

**Reading stats does not increment hits.** Measuring must not change the
measurement; there is a test that would fail if it did.

**`/:code` is registered last** so it cannot shadow `/health` or `/links`. There
is a test for that too, because route ordering is easy to break later.

## Known limits

Being honest about a toy: storage is an in-memory `Map`, so links are lost on
restart and it will not scale past one process. Codes are sequential, so they
are **guessable** — `CODE_OFFSET` is obfuscation, not security. A real
deployment would need persistent storage and either random codes or an
authorization check.

## Tests

- `base62.test.ts` — encoding round-trips, the single-to-double digit boundary,
  uniqueness across 5,000 values, and rejection of bad input.
- `link.service.test.ts` — rules with a hand-moved clock: expiry is checked one
  second before, exactly at, and after the boundary rather than by sleeping.
- `app.test.ts` — the HTTP surface: redirect status and `Location`, `410` on an
  expired link, and that stats counts redirects but not itself.
