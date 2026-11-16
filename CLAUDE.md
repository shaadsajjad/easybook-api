# EasyBook API (Backend)

## Project context
Backend for EasyBook, a Flutter service-booking mobile app (72-hour technical assessment).
Requirements: ./Flutter_Technical_Assessment_.pdf (sections 3, 4, 5 and Submission Requirements).
The developer will be interviewed on this code, so keep it simple, readable, and explainable.
After finishing each step, summarize what was built and why. Do not build ahead of the step requested.
Use the name "EasyBook" in the README, API docs and the AI assistant's system prompt.

## Assumptions (document these in the README)
- The spec defines only customers: no admin, staff, or provider role. Availability belongs to the service (one service cannot be booked twice at the same time).
- The spec defines read-only service endpoints. Services are managed through the seed script, not through the API.
- New appointments start as PENDING. There is no confirmation flow in scope; CONFIRMED and COMPLETED exist for seed/demo data.

## Tech stack
- Node.js 20+, TypeScript (strict mode), Express 4
- PostgreSQL on Neon (Singapore region), used only as plain Postgres
- Prisma ORM (schema, migrations, seed, generated types)
- Auth: jsonwebtoken (JWT) + bcryptjs (password hashing)
- Validation: Zod (schemas double as TypeScript types via z.infer)
- Security: helmet, cors, express-rate-limit
- Config: dotenv
- Testing: Vitest + Supertest (+ @types/supertest)
- Dev tooling: tsx (run and watch TypeScript), tsc (production build), @types/* packages
- AI: OpenRouter (OpenAI-compatible chat completions API) with free models, called with plain `fetch` (no extra SDK). A comma-separated model list gives fallback when a free model is rate-limited. Provider code isolated in `ai.service.ts` so it can be swapped (e.g. for Gemini or OpenAI). Chosen by the developer on 2026-11-16 instead of Gemini.
- Deployment: Render (Web Service)

## Rules of engagement
- Minimal abstraction. No repository layer, no DI containers, no unnecessary classes or base classes.
- Always output complete files, not partial snippets or diffs.
- One feature per step, with a small meaningful commit after each (conventional commits: feat:, fix:, docs:, test:, chore:, refactor:).
- Never commit secrets. Never print secrets or password hashes in logs or responses.
- Ask before adding any dependency not listed in this file (including logging and date/timezone libraries).
- Do not use Neon Auth, Neon Functions, or any other Neon services. Neon is used only as plain Postgres (a separate Neon branch/database for tests is fine, it is still just a Postgres connection string).
- TypeScript rules: `strict: true`, no `any` (use `unknown` and narrow), explicit return types on exported functions, prefer Prisma-generated types and Zod-inferred types over hand-written duplicates.
- Compile target is CommonJS (`"module": "commonjs"`) so imports need no file extensions.
- A step is NOT finished until its endpoints have passing tests AND their section in docs/API.md is written (see "Testing" and "API documentation").

## Architecture: feature-based (modules)
Each feature owns everything it needs in one folder. Shared code lives in `config`, `middleware`, `utils`, `types` and `tests`.

Per-feature file convention (create only the files a feature needs):
- `<feature>.routes.ts`: route definitions only (path, middleware, controller)
- `<feature>.controller.ts`: parse request, call the service, send the response. No business logic, no Prisma calls.
- `<feature>.service.ts`: business logic and all Prisma access for that feature
- `<feature>.validation.ts`: Zod schemas for body/query/params and their inferred input types
- `<feature>.types.ts`: response/DTO types and feature constants
- `<feature>.test.ts`: integration tests for every endpoint of that feature (colocated)

Dependency direction: routes -> controller -> service -> prisma. A feature may import another feature's service but never its controller or routes.

```
.
├── CLAUDE.md
├── README.md
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── render.yaml                    (optional Render blueprint)
├── .env.example
├── .env.test.example
├── .gitignore
├── docs/
│   ├── API.md                     (FRONTEND-FACING API documentation, see below)
│   ├── ER-diagram.md              (mermaid erDiagram)
│   └── requests.http              (REST Client requests)
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
└── src/
    ├── server.ts                  (entry: loads env, calls app.listen)
    ├── app.ts                     (builds and exports the Express app, NO listen)
    ├── routes.ts                  (mounts every feature router under /api/v1)
    ├── config/
    │   ├── env.ts                 (loads + validates env vars with Zod, fails fast, exports typed `env`)
    │   └── prisma.ts              (single PrismaClient instance)
    ├── middleware/
    │   ├── authenticate.ts        (verify JWT, attach req.user)
    │   ├── validate.ts            (runs a Zod schema on body/query/params)
    │   ├── rateLimiters.ts        (general, auth and ai limiters)
    │   ├── errorHandler.ts
    │   └── notFound.ts
    ├── utils/
    │   ├── ApiError.ts
    │   ├── asyncHandler.ts
    │   ├── response.ts            (sendSuccess helper)
    │   └── time.ts                (timezone + slot helpers, built on Intl, no extra dependency)
    ├── types/
    │   └── express.d.ts           (augments Request with `user`)
    ├── tests/
    │   ├── setup.ts               (loads .env.test, safety check, DB reset helpers)
    │   └── helpers.ts             (createUser, loginAs, createService, nextBookableSlot, etc.)
    └── modules/
        ├── health/        health.routes.ts, health.test.ts
        ├── auth/          auth.routes.ts, .controller.ts, .service.ts, .validation.ts, .types.ts, .test.ts
        ├── users/         users.routes.ts, .controller.ts, .service.ts, .validation.ts, .types.ts, .test.ts
        ├── services/      services.routes.ts, .controller.ts, .service.ts, availability.service.ts,
        │                  .validation.ts, .types.ts, .test.ts
        ├── appointments/  appointments.routes.ts, .controller.ts, .service.ts, .validation.ts, .types.ts, .test.ts
        └── ai/            ai.routes.ts, .controller.ts, .service.ts, .validation.ts, .types.ts, .test.ts
```

## Scripts (package.json)
```
"dev": "tsx watch src/server.ts"
"build": "tsc -p tsconfig.json"
"start": "node dist/server.js"
"typecheck": "tsc --noEmit"
"test": "vitest run"
"test:watch": "vitest"
"test:db:setup": "dotenv -e .env.test -- prisma migrate deploy"   (or an equivalent that loads .env.test; avoid a new dependency, e.g. a tiny tsx script, if dotenv-cli is not approved)
"prisma:generate": "prisma generate"
"prisma:migrate": "prisma migrate dev"
"prisma:deploy": "prisma migrate deploy"
"seed": "tsx prisma/seed.ts"
```
In package.json add `"prisma": { "seed": "tsx prisma/seed.ts" }`. Keep `prisma`, vitest, supertest and TypeScript tooling in devDependencies and `@prisma/client` in dependencies.

## Environment variables
Validate all of these in src/config/env.ts with Zod and export a typed `env` object. Commit `.env.example` with placeholders only.
```
NODE_ENV=development
PORT=4000
DATABASE_URL=            # Neon POOLED string (host contains -pooler), used at runtime. Append &pgbouncer=true if using the pooler with Prisma.
DIRECT_URL=              # Neon DIRECT string, used by prisma migrate
JWT_SECRET=              # long random string, min 32 chars
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=10
CORS_ORIGIN=*            # acceptable for a mobile client; document this choice
OPENROUTER_API_KEY=
OPENROUTER_MODELS=nvidia/nemotron-3.5-lightning:free,baidu/ernie-5.5-flash-preview:free,google/gemma-4-31b-it:free   # comma-separated fallback list
BUSINESS_TIMEZONE=Asia/Dhaka
BUSINESS_OPEN_HOUR=9
BUSINESS_CLOSE_HOUR=18
SLOT_INTERVAL_MINUTES=30
```

## Database design (Prisma)
Datasource: `url = env("DATABASE_URL")`, `directUrl = env("DIRECT_URL")`.
Generator: `provider = "prisma-client-js"`.

### Models
**User**: id (uuid), name, email (unique, stored lowercase), passwordHash, phone (optional), createdAt, updatedAt

**Service**: id (uuid), name, description, price (Decimal 10,2), durationMinutes (Int), imageUrl, category (String), isFeatured (Boolean, default false), isActive (Boolean, default true), createdAt, updatedAt

**Appointment**: id (uuid), userId (FK to User), serviceId (FK to Service), startTime (DateTime, UTC), endTime (DateTime, UTC), status (enum), notes (optional), createdAt, updatedAt

**Enum AppointmentStatus**: PENDING, CONFIRMED, CANCELLED, COMPLETED

Relations: User 1-N Appointment, Service 1-N Appointment.
Indexes: Appointment(userId, startTime), Appointment(serviceId, startTime), Service(category), Service(isFeatured).

### Double-booking protection (two layers, both required)
1. **Service layer:** in `appointments.service.ts`, inside a Prisma `$transaction`, check for any non-cancelled appointment on the same service whose time range overlaps [startTime, endTime). If found, throw ApiError 409.
2. **Database layer:** add a hand-written SQL migration (Prisma cannot express it) that enables `btree_gist` and adds an exclusion constraint:
   `EXCLUDE USING gist ("serviceId" WITH =, tstzrange("startTime", "endTime") WITH &&) WHERE (status <> 'CANCELLED')`
   Catch the resulting Postgres error (code 23P01, surfaced by Prisma as a raw/unknown request error) and convert it to a 409. This closes the race condition between two simultaneous requests. If the column types need a cast for tstzrange, handle it in the migration.
Explain both layers in the README under "Design decisions".

## Booking rules
- All times are stored and transmitted in UTC (ISO 8601). Business hours are interpreted in BUSINESS_TIMEZONE.
- Slots start on a SLOT_INTERVAL_MINUTES grid between open and close hours. endTime = startTime + service.durationMinutes and must end at or before closing time. startTime must be on the slot grid.
- Cannot book in the past. Cannot book an inactive service.
- New appointments are created as PENDING.
- Only the owner can view or cancel their appointment. Accessing someone else's returns 404.
- Only PENDING appointments can be cancelled; otherwise return 409 with a clear message.
- "upcoming" = startTime >= now and status in (PENDING, CONFIRMED). "past" = everything else (earlier, cancelled, or completed).

## API (all routes under /api/v1)

### Health
- GET /health (public) returns { status: "ok", uptime }

### Auth (public, strict rate limit)
- POST /auth/register { name, email, password } returns user + token
- POST /auth/login { email, password } returns user + token
Password rules: min 8 chars, at least one letter and one number. Login errors are generic ("Invalid email or password") to avoid user enumeration.

### Users (protected)
- GET /users/me
- PATCH /users/me { name?, phone? } (email cannot be changed)
- PATCH /users/me/password { currentPassword, newPassword } (optional, build last)

### Services (public)
- GET /services?search=&category=&featured=&minPrice=&maxPrice=&page=&limit=
  Search matches name and description, case-insensitive. Defaults: page=1, limit=20 (max 50). Return pagination meta.
- GET /services/categories returns the distinct category list
- GET /services/:id
- GET /services/:id/availability?date=YYYY-MM-DD returns every slot for that date with `available: true|false` (false if booked, in the past, or does not fit before closing)

### Appointments (protected)
- POST /appointments { serviceId, startTime, notes? }
- GET /appointments?type=upcoming|past&status=
- GET /appointments/:id (include service summary)
- PATCH /appointments/:id/cancel

### AI (protected, rate-limited)
- POST /ai/chat { message, history?: [{ role: "user"|"assistant", content }] }
  returns { reply, suggestedServices?: [{ id, name }] }

## Response format
Success:
```json
{ "success": true, "data": {}, "message": "optional", "meta": {} }
```
Error:
```json
{ "success": false, "message": "Human readable message", "errors": [{ "field": "email", "message": "Invalid email" }] }
```
Status codes: 200, 201, 400 (malformed), 401 (no/invalid token), 403, 404, 409 (conflict), 422 (validation), 429 (rate limit), 500.
The central errorHandler maps ApiError, ZodError, Prisma known errors (P2002 unique, P2025 not found), the exclusion-constraint error, and unknown errors. Never leak stack traces or internals in production.

## Testing (every endpoint must be tested)
Tooling: Vitest + Supertest, importing the Express app from `src/app.ts` directly (no real port needed).

### Test database (never test against dev or production data)
- Tests use a SEPARATE database: create a second Neon branch or database and put its strings in `.env.test` (git-ignored). Commit `.env.test.example` with placeholders.
- `src/tests/setup.ts` loads `.env.test` and MUST abort the whole run if the database URL equals the one in `.env`, or if NODE_ENV is not "test". Tests truncate tables, so this safety check is mandatory.
- Run `npm run test:db:setup` once to apply migrations (including the exclusion-constraint migration) to the test database.
- vitest.config.ts: `fileParallelism: false` (test files share one database, so they must run sequentially), and a generous per-test timeout for the remote DB.
- Reset data between tests (truncate users, services, appointments), then create what each test needs through `src/tests/helpers.ts`. Tests must not depend on each other or on seed data.
- Tests must not depend on the current clock: use a helper that returns the next bookable slot (a future business day, inside business hours, on the slot grid).

### Coverage required for each endpoint
Each `<feature>.test.ts` has one `describe` per endpoint, named exactly like the route (e.g. `describe("POST /api/v1/appointments")`), and test names written as plain sentences (e.g. "returns 409 when the slot is already booked"), because these names feed docs/API.md.
For every endpoint cover at least:
- the success case (check status code AND response body shape)
- validation failures (missing/invalid fields, each returning 422 with a field-level `errors` array)
- authentication: protected routes return 401 with no token, a malformed token, and an expired token
- authorization/ownership: another user's resource returns 404
- not-found cases (unknown id, invalid uuid format)
- feature-specific rules:
  - auth: duplicate email (409), wrong password and unknown email return the same generic 401 message, password is never present in any response
  - users: cannot change email, update only allowed fields, (optional) change password with wrong current password
  - services: search (case-insensitive), category filter, featured filter, price range, pagination meta, inactive services hidden, categories list, availability marks booked/past/overflowing slots as unavailable
  - appointments: create success returns PENDING; past time, off-grid time, outside business hours, inactive service; double booking returns 409; two simultaneous requests for the same slot result in exactly one success (proves the DB-level constraint); a cancelled booking frees the slot; cancel only PENDING (CONFIRMED/COMPLETED/CANCELLED return 409); upcoming vs past filtering; status filter
  - ai: success with the OpenRouter call MOCKED (stub global `fetch`; never call the real API or use the real key in tests), message too long, history trimmed, provider failure/timeout returns a friendly 502/503, requires auth
- error shape: every error response matches `{ success: false, message, errors? }`; unknown routes return 404 in the same shape.

## API documentation (docs/API.md) — written for the FRONTEND developer
This file is what gets shared with the Flutter developer, so a frontend dev with no backend knowledge must be able to build against it without asking questions. Write it in plain, friendly language.

Required structure:
1. **Overview**: what EasyBook is, in two sentences.
2. **Base URLs**: local (`http://localhost:4000/api/v1`) and production (Render URL placeholder to fill in after deploy). Note for Android emulator: `http://10.0.2.2:4000/api/v1`. Note that Render free tier may take 30-50 seconds on the first request after idle.
3. **Quick start**: three steps (register, use the token, fetch services) with ready-to-copy examples.
4. **Authentication**: how to send the token (`Authorization: Bearer <token>`), token lifetime, what a 401 means and what the app should do (send the user to login).
5. **Conventions**: success and error response shapes with examples, pagination format, ISO 8601 UTC time rule ("always send and receive UTC, convert to local time for display"), how price is returned (decimal as string or number, state exactly which), and the enum values (AppointmentStatus).
6. **Status codes and errors table**: each status code, when it happens, and what the app should show.
7. **Booking flow guide**: the exact sequence the app follows: list services -> service detail -> pick a date -> GET availability -> POST appointment -> show confirmation -> My Bookings -> cancel. Include which status can be cancelled.
8. **Endpoints**: one section per endpoint, each containing:
   - method + path, one-line purpose, "Auth required: Yes/No"
   - request: headers, path/query params and body as a table (field, type, required, rules/example)
   - a **real** success response example (copy from an actual call or test output, never invent)
   - error responses relevant to that endpoint, each with a real example body
   - **Tested scenarios**: a checklist taken from that endpoint's test names (these show the frontend dev exactly which behaviors are guaranteed)
   - a short **Frontend notes** line where useful (e.g. "disable the Book button when `available` is false")
9. **Data models**: User, Service, Appointment JSON shapes with every field, type and nullability (Dart-friendly: mark nullable fields clearly).
10. **Demo credentials**: the seeded demo user.
11. **Test coverage summary**: a table of endpoint -> number of tests -> passing status (update it from the latest `npm test` run).
12. **Changelog**: short dated list of API changes so the frontend dev can see what moved.

Keeping it honest:
- Every example comes from a real response (run the API or read the test output). If behavior changes, update the doc in the same commit.
- Each build step adds/updates the docs for the endpoints it touched, in the same commit as the code and tests.

## AI assistant spec
- The API key is read from env on the backend only, never sent to or referenced by the client.
- On each request: load active services from the DB (id, name, description, price, duration, category) and inject them into the system prompt as context.
- System prompt: you are the EasyBook booking assistant; answer only from the provided services; recommend based on the user's needs; mention price and duration; if the question is unrelated to services or booking, politely decline and steer back; never invent services or prices.
- Limit history to the last 10 messages and message length to 500 chars.
- Request timeout about 15 seconds using AbortController. On timeout or provider error, return 502/503 with a friendly message, never a raw provider error.
- All provider-specific code stays inside `ai.service.ts`.

## Security checklist
- Passwords hashed with bcryptjs; never stored or returned in plain text, and the hash is never returned.
- JWT verified in `authenticate` middleware; expired or invalid tokens return 401; the user is attached to `req.user` (typed through `types/express.d.ts`).
- Zod validation on every body, query and params via the `validate` middleware.
- helmet enabled; rate limiting on /auth and /ai; JSON body size limit (10kb). In the test environment, rate limits are relaxed or disabled so tests do not trip them, and one dedicated test confirms the limiter returns 429.
- `app.set("trust proxy", 1)` so rate limiting sees the real client IP behind Render's proxy.
- Ownership checks on all appointment access.
- Prisma only (parameterized); no string-built SQL except the static migration.
- Secrets only in env vars; `.env` and `.env.test` in .gitignore.

## Render deployment
- Service type: Web Service, region Singapore (to sit next to Neon).
- Build command: `npm install --include=dev && npx prisma generate && npm run build`
- Start command: `npm start` (runs `node dist/server.js`)
- Listen on `process.env.PORT`, bind to `0.0.0.0`.
- Health check path: `/api/v1/health`
- Env vars are set in the Render dashboard (every variable listed above). Never commit them.
- Migrations are run from the developer machine with `npm run prisma:deploy` (uses DIRECT_URL), not during the Render build.
- Free tier sleeps after idle, so the first request can take 30-50 seconds. Note this in the README, and warm the service before the demo or a review.
- Optionally add a `render.yaml` blueprint mirroring these settings (secrets marked `sync: false`).
- Deploy a minimal /health endpoint FIRST (before building features) to prove the Render + Prisma + Neon pipeline works.

## Seed data (prisma/seed.ts, idempotent: safe to run repeatedly)
- 8 to 10 realistic services across 3 to 4 categories (e.g. Hair & Beauty, Wellness, Home Services, Health), with price, durationMinutes, imageUrl (stable public image URLs), and 3 to 4 marked isFeatured. Use upsert on a stable key so reruns do not create duplicates.
- 1 demo user (demo@example.com / Demo1234) and a few sample appointments with mixed statuses (a past COMPLETED one, a future CONFIRMED one, a CANCELLED one, a PENDING one) so the Flutter app has data immediately.
- The seed is for dev/demo only; tests never rely on it.

## Other deliverables
- docs/requests.http: a request for every endpoint (variables for baseUrl and token), including a double-booking attempt that returns 409 and an unauthorized-access attempt.
- docs/ER-diagram.md: mermaid erDiagram of User, Service, Appointment.
- README.md: overview, tech stack, architecture (feature-based, with the folder tree), prerequisites, setup (clone, install, env, migrate, seed, run), how to run tests (including the test database setup), scripts, Render deploy steps, assumptions, design decisions (JWT, two-layer conflict protection, UTC handling, AI key security, why feature-based structure), a link to docs/API.md, and a link to the Flutter repo.

## Build order (do ONE step at a time, then stop and summarize)
Every step from 5 onward ends with: tests written and passing (`npm test`), `npm run typecheck` clean, docs/API.md sections for the new endpoints written, then one commit.
1. Plan: propose the schema, slot logic, conflict approach, test strategy and the file list. Wait for approval.
2. Scaffold: package.json, tsconfig, vitest config, env config, app/server split, middleware, error handling, health module with its test, and the skeleton of docs/API.md (sections 1-7). Commit.
3. Prisma schema, migration, exclusion-constraint SQL migration, apply to the dev DB and the test DB, seed, tests setup + helpers (with the database safety check). Commit.
4. Deploy checkpoint: confirm /api/v1/health works on Render, fill in the production base URL in docs/API.md. Commit any fixes.
5. Auth module + users module, with tests and docs. Commit.
6. Services module (list, detail, categories, availability), with tests and docs. Commit.
7. Appointments module with conflict handling, with tests (including the concurrent-booking test) and docs. Commit.
8. AI module with mocked-provider tests and docs. Commit.
9. Optional: change password, with tests and docs. Commit.
10. Final pass: README, ER diagram, requests.http, docs/API.md completed (data models, coverage summary table from the latest test run, changelog), full `npm test` and `npm run typecheck`, security and type-safety review of the whole codebase. Commit.
