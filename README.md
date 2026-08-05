# School ERP

A school management platform: multi-tenant, permission-driven, and built module
by module on shared infrastructure so that adding a feature is a matter of
writing the module, not wiring plumbing.

## Implemented modules

| Module             | What it covers                                                          |
| ------------------ | ----------------------------------------------------------------------- |
| **Auth**           | JWT access + refresh, session restore, password reset                   |
| **Users & roles**  | Accounts, role assignment, permission-based RBAC                        |
| **Academic years** | Terms, current-year tracking                                            |
| **Classes**        | Class levels and their sections                                         |
| **Sections**       | Divisions, capacity, class teacher                                      |
| **Mediums**        | Languages of instruction                                                |
| **Subjects**       | Curriculum, per-class allocation, subject teachers                      |
| **Teachers**       | Staff records, qualifications, subject and section allocations          |
| **Students**       | Enrolment, admission numbers, class placement                           |
| **Parents**        | Guardians, contact details, emergency contacts, student relationships   |

Every module is multi-tenant (scoped to a school), permission-guarded, audited,
and documented in Swagger.

## Stack

| Layer     | Choice                                                          |
| --------- | --------------------------------------------------------------- |
| Frontend  | React 18, TypeScript, Vite, Tailwind CSS, Material UI            |
| State     | Redux Toolkit (client state), TanStack Query (server state)      |
| Backend   | NestJS 11, TypeScript                                            |
| Database  | PostgreSQL 16 via Prisma ORM                                     |
| Auth      | JWT (access + refresh), Passport, role/permission RBAC           |
| Docs      | Swagger / OpenAPI 3                                              |
| Logging   | Pino (structured JSON, request-correlated, secret-redacting)     |
| Packaging | Docker + Docker Compose, multi-stage builds                      |

## Layout

```
School-ERP/
├── docker-compose.yml          # postgres + backend + frontend (+ pgadmin profile)
├── .env.example                # compose-level variables
│
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # identity, RBAC, academics, people
│   │   ├── migrations/         # one folder per applied migration
│   │   └── seed.ts             # idempotent: permissions, roles, super admin
│   └── src/
│       ├── main.ts             # bootstrap: helmet, CORS, prefix, versioning, Swagger
│       ├── app.module.ts       # composition root — all cross-cutting concerns
│       ├── config/             # env schema, typed config namespaces, Swagger setup
│       ├── common/             # decorators, guards, filters, interceptors, DTOs
│       ├── core/               # prisma, logger, health — infrastructure services
│       └── modules/            # one folder per feature
│           ├── auth/           # JWT strategy, login, refresh, password reset
│           ├── users/          # accounts and role assignment
│           ├── academic-years/
│           ├── classes/  sections/  mediums/  subjects/
│           └── teachers/  students/  parents/
│
└── frontend/
    └── src/
        ├── app/                # store, router, theme, providers
        ├── features/           # mirrors the backend modules
        │   ├── auth/           # session slice, useAuth, ProtectedRoute
        │   └── users/  classes/  subjects/  teachers/  students/  parents/  …
        ├── shared/             # api client, components, hooks, types, utils
        └── config/             # validated VITE_ env
```

Both sides are **feature-based**: `modules/<feature>/` on the backend,
`features/<feature>/` on the frontend. Cross-feature code lives in
`common`/`core` and `shared` respectively.

## Getting started

### With Docker (recommended)

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Generate real JWT secrets, then edit backend/.env:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

docker compose up -d --build
docker compose exec backend npx prisma migrate dev --name init
docker compose exec backend npm run prisma:seed
```

### Without Docker

Requires Node 20+ and a PostgreSQL 16 instance.

```bash
# Backend
cd backend
npm install
cp .env.example .env          # set DATABASE_URL + JWT secrets
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev

# Frontend (second terminal)
cd frontend
npm install
cp .env.example .env
npm run dev
```

| Service    | URL                            |
| ---------- | ------------------------------ |
| Frontend   | http://localhost:3000          |
| API        | http://localhost:4000/api/v1   |
| Swagger UI | http://localhost:4000/api/docs |
| Health     | http://localhost:4000/health/ready |
| pgAdmin    | http://localhost:5050 (`docker compose --profile tools up -d`) |

The seed prints a bootstrap super-admin login. **Change that password before
exposing the API anywhere.**

## What's already wired

Registered once in `app.module.ts`, so every module inherits them:

- **Global validation** — `ValidationPipe` with `whitelist` and
  `forbidNonWhitelisted`; undeclared properties are rejected, not ignored.
- **Error handling** — `AllExceptionsFilter` maps `HttpException` and Prisma
  error codes (`P2002` → 409, `P2025` → 404, …) to one response shape. Stack
  traces are logged, never returned.
- **Response envelope** — `TransformInterceptor` wraps success payloads as
  `{ success, data, timestamp, path, requestId }`.
- **Authentication** — `JwtAuthGuard` is global; routes are private by default
  and opt out with `@Public()`. See [Authentication](#authentication).
- **Authorization** — `RolesGuard` reads `@Roles()` / `@RequirePermissions()`.
- **Logging** — Pino, JSON in production, request-id correlated, with
  `Authorization`, cookies, passwords, and tokens redacted.
- **Rate limiting, CORS, Helmet, compression, request timeout, graceful shutdown.**
- **Health probes** — `/health/live` and `/health/ready`, deliberately outside
  the API prefix and version so orchestrator config survives version bumps.

## Authentication

Endpoints live under `/api/v1/auth`:

| Method  | Path               | Auth      | Purpose                                    |
| ------- | ------------------ | --------- | ------------------------------------------ |
| `POST`  | `/login`           | public    | Verify credentials, start a session        |
| `POST`  | `/refresh`         | cookie    | Rotate the refresh token, mint an access token |
| `POST`  | `/logout`          | bearer    | End this device's session                  |
| `POST`  | `/logout-all`      | bearer    | End every session for the account          |
| `POST`  | `/forgot-password` | public    | Email a reset link                         |
| `POST`  | `/reset-password`  | public    | Consume a reset token, set a new password  |
| `PATCH` | `/change-password` | bearer    | Change your own password                   |
| `GET`   | `/me`              | bearer    | Profile, roles, and permissions            |

### Token strategy

**Access token** — a short-lived (15m) JWT returned in the response body and
held in a JavaScript variable on the client. It is deliberately *not* written to
localStorage or sessionStorage: anything in web storage is readable by any
script on the origin, so one XSS bug would leak the session.

**Refresh token** — a 256-bit random string in an `httpOnly`, `SameSite=Strict`
cookie scoped to `/api/v1/auth`. Script cannot read it, and `SameSite=Strict`
means it is never attached to a cross-site request, which is what removes the
need for a separate CSRF token on this endpoint. Only its SHA-256 digest is
stored, so a database leak yields no usable sessions.

Because the access token is in memory, a page reload loses it. The app silently
calls `/auth/refresh` on start (`useSessionRestore`) and restores the session
from the cookie.

This assumes the SPA and API are **same-origin**, which both deployment paths
already provide — the Vite proxy in development, nginx in production.

### Rotation and reuse detection

Every refresh revokes the presented token and issues a new one in the same
*family*. Presenting an already-revoked token means it leaked, so the entire
family is revoked — logging out both the attacker and the legitimate user on
that device, which is the safe failure.

This is why the Axios interceptor coalesces concurrent 401s into a **single**
refresh: two parallel refreshes would each spend the cookie, and the second
would look like a replay and kill the session. That behaviour is pinned by a
test in [http-client.test.ts](frontend/src/shared/api/http-client.test.ts).

### Other hardening

- **Argon2id** hashing at the OWASP baseline (19 MiB, t=2, p=1), with automatic
  re-hashing when a stored hash predates the current parameters.
- **No user enumeration** — a wrong password and an unknown address return the
  same message, and the unknown path still spends hashing time so responses
  cannot be told apart by latency. `forgot-password` always answers 202.
- **Account lockout** after 5 consecutive failures (15 minutes, configurable).
- **Endpoint-specific rate limits** — 5/min on login, 3 per 5 min on
  forgot-password, over and above the global throttle.
- **`passwordChangedAt`** invalidates access tokens issued before a password
  change, so changing a password ends a hijacked session immediately rather
  than at token expiry.
- Password strength is enforced where passwords are **set**, never on login —
  rejecting a login on complexity grounds would lock out anyone whose password
  predates the current policy.

> **Email is a stub.** [MailService](backend/src/core/mail/mail.service.ts) logs
> reset links in development instead of sending them, and in production it warns
> loudly and delivers nothing. Wire a real provider before relying on password
> recovery; no call sites change.

## User management

Endpoints under `/api/v1/users`, each gated by its own permission:

| Method   | Path                  | Permission            |
| -------- | --------------------- | --------------------- |
| `GET`    | `/`                   | `user:read`           |
| `GET`    | `/roles`              | `role:read`           |
| `GET`    | `/:id`                | `user:read`           |
| `POST`   | `/`                   | `user:create`         |
| `PATCH`  | `/:id`                | `user:update`         |
| `PATCH`  | `/:id/status`         | `user:update`         |
| `PUT`    | `/:id/roles`          | `user:assign-role`    |
| `POST`   | `/:id/reset-password` | `user:reset-password` |
| `DELETE` | `/:id`                | `user:delete`         |

Changing someone's password and changing what they can do are **separate
permissions from `user:update`** — both are privilege-adjacent, so a role can be
allowed to fix a typo in a surname without being able to grant itself admin.
By default only `ADMIN` holds them; `MANAGER` gets create/read/update.

The list endpoint paginates, searches name and email case-insensitively, and
filters by status, role, and school. `sortBy` is validated against a whitelist —
that value reaches Prisma's `orderBy`, so an unchecked field name would be a
runtime failure.

### Lockout protections

These are enforced in the service, not the UI, and each is covered by a test:

- An administrator cannot delete, disable, or demote **themselves** — that would
  end their own session mid-action.
- No change may remove the **last active administrator**, which would otherwise
  lock everyone out of user management permanently.
- Only an `ADMIN` can grant the `ADMIN` role, so a `MANAGER` holding
  `user:assign-role` cannot promote themselves.

Disabling an account, resetting its password, or changing its roles revokes
every session for that user immediately.

### Delete semantics

`DELETE` is a **soft delete**: the row is retained so audit history stays
meaningful. Because `email` is globally unique, the address would otherwise be
blocked forever, so it is rewritten to a tombstone (`deleted+<epoch>+<original>`)
that frees it for reuse while keeping the original recoverable. Use *disable*
for a reversible block.

## Academic years

`/api/v1/academic-years` — create, edit, activate, archive. Statuses are
`UPCOMING → ACTIVE → ARCHIVED`, and **archived is terminal**.

### One active year, enforced by the database

The rule "only one active year per school" is not left to a service-level check,
which two concurrent activations could both pass. `AcademicYear` carries an
`activeMarker` column set to `true` while active and `NULL` otherwise, under a
unique index on `(schoolId, activeMarker)`. Postgres treats NULLs as distinct, so
any number of non-active years coexist while a second `ACTIVE` row is rejected
outright. A lost race surfaces as a clear 409 rather than corrupt data.

Activating archives the outgoing year **atomically, in one transaction**, so a
school is never left with two active years nor a gap with none. The response
reports both affected years, and the UI names the year that will be archived
before you confirm.

Other rules: dates are date-only (`YYYY-MM-DD`, no timezone — a full timestamp
would make "when does the year start" depend on the caller's offset); the end
date must fall after the start; and ranges may not overlap another year in the
same school, since overlapping sessions make any dated record ambiguous.

## Classes and sections

`/api/v1/classes` — a **class** is a grade ("Class 10") within one academic year;
a **section** ("A") is a division of it carrying its own capacity and class
teacher. Sections are managed through their class, so both share the `class:*`
permissions.

| Method   | Path                       | Purpose                        |
| -------- | -------------------------- | ------------------------------ |
| `GET`    | `/classes`                 | Paginated, with nested sections |
| `GET`    | `/classes/teachers`        | Teachers eligible as class teacher |
| `POST`   | `/classes`                 | Create a class                 |
| `PATCH`  | `/classes/:id`             | Edit, including active status  |
| `DELETE` | `/classes/:id`             | Delete (cascades to sections)  |
| `POST`   | `/classes/:id/sections`    | Add a section                  |
| `PATCH`  | `/classes/sections/:id`    | Edit a section                 |
| `DELETE` | `/classes/sections/:id`    | Delete a section               |

Classes are scoped to an academic year rather than the school, because the
sections, capacities, and class teachers of Class 10 differ from one session to
the next. When no `academicYearId` is given, the school's active year is used.

Rules worth knowing:

- A **class teacher must be active staff at the same school** holding the
  `TEACHER` or `HEADMASTER` role, and may hold **only one section per academic
  year** — the role is a pastoral responsibility, not a label. The teacher picker
  greys out anyone already assigned and says where.
- Classes in an **archived** year are frozen; past attendance and results must
  keep reconciling.
- `totalCapacity` sums **active sections only** — an inactive section is not
  taking students.
- Deleting a class removes its sections; deactivating keeps them.

## RBAC model

Two layers, both enforced server-side:

- **Roles** — coarse: `ADMIN`, `MANAGER`, `HEADMASTER`, `TEACHER`, `PARENT`.
- **Permissions** — fine, as `resource:action` strings (`student:create`).
  A `resource:manage` grant satisfies every action on that resource, and
  `ADMIN` bypasses all checks.

Guarding an endpoint:

```ts
@RequirePermissions(PERMISSIONS.student.create)
@Post()
create(@Body() dto: CreateStudentDto, @CurrentUser('id') userId: string) { ... }
```

Roles and permissions are re-read from the database on every request rather than
trusted from the token, so revoking access takes effect immediately instead of at
token expiry. Declare new permissions in
[permissions.constant.ts](backend/src/common/constants/permissions.constant.ts),
grant them in [roles.constant.ts](backend/src/common/constants/roles.constant.ts),
and re-run the seed — no schema change needed.

The frontend mirrors this in `useAuth().hasRole/hasPermission` and
`<ProtectedRoute>` **for UX only**. The API is the authority; client checks just
avoid showing actions that would be rejected.

## Adding a feature module

Backend:

```bash
cd backend
npx nest g module modules/students
npx nest g controller modules/students
npx nest g service modules/students
```

1. Add models to `prisma/schema.prisma`, then `npm run prisma:migrate`.
2. Declare permissions in `common/constants/permissions.constant.ts` and grant
   them in `roles.constant.ts`; re-run the seed.
3. Guard endpoints with `@RequirePermissions(...)` and tag the controller with
   `@ApiTags('Students')` — Swagger picks it up automatically.
4. Register the module in `app.module.ts`.

Frontend: create `src/features/students/` with `api/`, `components/`, `hooks/`,
`pages/`, `store/`, add routes in `app/router/AppRouter.tsx` behind
`<ProtectedRoute permissions={['student:read']}>`, and register any slice in
`app/store/index.ts`.

## Scripts

Both packages expose the same verbs:

| Command             | Effect                                  |
| ------------------- | --------------------------------------- |
| `npm run dev` / `start:dev` | Watch-mode dev server           |
| `npm run build`     | Production build                        |
| `npm run lint`      | ESLint, zero-warnings enforced          |
| `npm run format`    | Prettier write                          |
| `npm run typecheck` | Types only, no emit                     |
| `npm test`          | Unit tests                              |

Backend also has `prisma:migrate`, `prisma:deploy`, `prisma:studio`,
`prisma:seed`, `prisma:reset`, and `test:e2e`.

## Before production

- [ ] Fresh `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (must differ — enforced at boot)
- [ ] `NODE_ENV=production`, `LOG_PRETTY=false`, `SWAGGER_ENABLED=false`
- [ ] `COOKIE_SECURE=true` (enforced at boot in production) and HTTPS end to end
- [ ] `WEB_APP_URL` set to the real SPA origin, or reset links point at localhost
- [ ] `CORS_ORIGINS` set to real origins (never `*`)
- [ ] `BUILD_TARGET=production` so compose uses the hardened image stages
- [ ] `prisma migrate deploy` (not `migrate dev`) in the release pipeline
- [ ] Rotate the seeded admin password
- [ ] **Replace the MailService stub** — password recovery silently does nothing
      until a real provider is wired up
- [ ] Schedule `TokenService.pruneExpired()`; `refresh_tokens` grows per login
