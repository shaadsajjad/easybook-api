# EasyBook API

Backend for **EasyBook**, a Flutter mobile app for booking local services: browse services, check available time slots, book and cancel appointments, and get recommendations from an AI assistant.

- **API documentation for the app developer:** [docs/API.md](docs/API.md)
- **Database schema / ER diagram:** [docs/ER-diagram.md](docs/ER-diagram.md)
- **Ready-made requests:** [docs/requests.http](docs/requests.http)
- **Flutter app repository:** _&lt;add the Flutter repo link here&gt;_
- **Production base URL:** `https://easybook-api-d89z.onrender.com/api/v1` (health check: [https://easybook-api-d89z.onrender.com/api/v1/health](https://easybook-api-d89z.onrender.com/api/v1/health))

---

## Features

| Area | What it does |
|---|---|
| Auth | Register and login with JWT. Passwords hashed with bcrypt. Generic login errors (no user enumeration). Strict rate limit. |
| Profile | View and update name and phone. Change password. The email cannot be changed. |
| Services | List with search (name and description), category, featured and price filters, plus pagination. Detail, categories and **availability per day**. |
| Appointments | Book, list (upcoming or past, filter by status), detail, cancel (only `PENDING`). **No double booking**, even with simultaneous requests. |
| AI assistant | Chat that recommends services from the live catalogue (OpenRouter free models). The key never leaves the server. |
| Quality | 163 integration tests against a real Postgres test database. TypeScript strict mode. Consistent JSON response shape. |

## Tech stack

| Concern | Choice |
|---|---|
| Runtime / language | Node.js 22, TypeScript (strict), compiled to CommonJS |
| Web framework | Express 4 |
| Database | PostgreSQL on Neon (Singapore), used as plain Postgres |
| ORM / migrations | Prisma 6 |
| Validation | Zod 4 (schemas also give the TypeScript types) |
| Auth | jsonwebtoken (HS256) + bcryptjs |
| Security | helmet, cors, express-rate-limit, 10 KB JSON limit |
| AI | OpenRouter chat completions (OpenAI-compatible) with free models, called with plain `fetch` |
| Tests | Vitest + Supertest |
| Hosting | Render (Web Service) |

## Architecture

**Feature-based modules.** Each feature folder holds its routes, controller, service, validation, types and tests, so one feature is in one place. Shared code lives in `config`, `middleware`, `utils` and `tests`.

```
src/
├── server.ts                 starts the HTTP server (only file that calls listen)
├── app.ts                    builds the Express app (imported directly by tests)
├── routes.ts                 mounts every feature under /api/v1
├── config/                   env.ts (validated env vars), prisma.ts (one shared client)
├── middleware/               authenticate, validate, rateLimiters, errorHandler, notFound
├── utils/                    ApiError, asyncHandler, response, time, uuid, prismaErrors
├── types/express.d.ts        adds req.user to Express's Request type
├── tests/                    setup.ts (test DB safety check), helpers.ts, database.test.ts
└── modules/
    ├── health/               GET /health
    ├── auth/                 register, login
    ├── users/                me, update profile, change password
    ├── services/             list, detail, categories, availability (availability.service.ts)
    ├── appointments/         create, list, detail, cancel
    └── ai/                   chat (all provider code in ai.service.ts)
prisma/
├── schema.prisma             models, enum, relations, indexes
├── migrations/               init + hand-written exclusion constraint
└── seed.ts                   idempotent demo data
docs/                         API.md, ER-diagram.md, requests.http
```

**Request flow:** `routes → middleware (auth, rate limit, Zod validation) → controller → service → Prisma`.
- Controllers only read the request and send the response.
- Business rules and all database access live in the services.
- A feature may use another feature's service. For example, appointments uses `services.service` and `availability.service`.

## Prerequisites

- Node.js **22.12+** (on macOS with Homebrew: `brew install node@22`, then add `/opt/homebrew/opt/node@22/bin` to your `PATH`)
- A PostgreSQL database. This project uses [Neon](https://neon.tech): one database for development, and a **separate** one for tests.
- An [OpenRouter](https://openrouter.ai) API key (free models) for the AI assistant. Optional: without it, `/ai/chat` returns 503 and everything else works.

## Setup

```bash
git clone <this-repo-url> easybook-api
cd easybook-api
npm install

cp .env.example .env          # then fill in the values (see below)
npm run prisma:deploy         # create the tables + exclusion constraint
npm run seed                  # demo services, demo user and sample bookings
npm run dev                   # http://localhost:4000/api/v1/health
```

### Environment variables

All variables are validated at startup (`src/config/env.ts`). The app refuses to start with a clear list of problems, and it never prints the values.

| Variable | Example / default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `development`, `test` or `production` |
| `PORT` | `4000` | Render sets this automatically |
| `DATABASE_URL` | Neon **pooled** URL | Host contains `-pooler`. Add `&pgbouncer=true&connect_timeout=15` and remove `channel_binding` |
| `DIRECT_URL` | Neon **direct** URL | Same host without `-pooler`. Used by `prisma migrate` |
| `JWT_SECRET` | 64 random hex chars | At least 32 characters, e.g. `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `BCRYPT_ROUNDS` | `10` | Hashing cost (tests use 4 for speed) |
| `CORS_ORIGIN` | `*` | Fine for a mobile app (see design decisions). Comma-separated list to restrict browsers |
| `OPENROUTER_API_KEY` | `sk-or-v1-…` | Server only, never sent to the app |
| `OPENROUTER_MODELS` | `nvidia/nemotron-3.5-lightning:free,…` | Comma-separated fallback list, tried in order |
| `BUSINESS_TIMEZONE` | `Asia/Dhaka` | Business hours are interpreted in this zone |
| `BUSINESS_OPEN_HOUR` / `BUSINESS_CLOSE_HOUR` | `9` / `18` | Opening hours (24h) |
| `SLOT_INTERVAL_MINUTES` | `30` | Booking grid |

### Demo account

After `npm run seed`: **`demo@example.com` / `Demo1234`**. It comes with 10 services in 4 categories (4 featured) and four bookings, one each of COMPLETED, CONFIRMED, CANCELLED and PENDING. Running the seed again resets the demo bookings and creates no duplicates.

## Running the tests

Tests run against a **separate test database**, because they delete all rows before each test.

```bash
cp .env.test.example .env.test   # point DATABASE_URL / DIRECT_URL at the TEST database
npm run test:db:setup            # apply migrations to the test database (once, and after new migrations)
npm test                         # run all tests
npm run typecheck                # TypeScript, no output = OK
```

- **Safety check:** `src/tests/setup.ts` aborts the whole run if `NODE_ENV` isn't `test`, or if `.env.test` points at the same database as `.env`.
- **No shared state:** every test starts from an empty database and creates what it needs with `src/tests/helpers.ts`. Tests never use the seed data.
- **No dependence on the clock:** bookings use `nextBookableSlot()`, which is always a future business day, and "now" is passed in where time matters.
- **No real AI calls:** global `fetch` is stubbed, so the real API is never called.
- **Concurrency:** one test fires 5 simultaneous bookings for the same slot and expects exactly one success.
- Test files run one after another (`fileParallelism: false`) because they share one database.

Latest run: **163 tests passing** (per-endpoint breakdown in [docs/API.md, section 11](docs/API.md#11-test-coverage-summary)).

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start with auto-reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` (app code only, no tests or seed) |
| `npm start` | Run the compiled app (`node dist/server.js`) |
| `npm run typecheck` | Type-check app, tests and seed |
| `npm test` / `npm run test:watch` | Run the tests once, or in watch mode |
| `npm run test:db:setup` | Apply migrations to the test database (reads `.env.test`) |
| `npm run prisma:migrate` | Create and apply a new migration in development |
| `npm run prisma:deploy` | Apply pending migrations (dev or production) |
| `npm run prisma:generate` | Regenerate the Prisma client |
| `npm run seed` | Load demo data (idempotent) |

## Deploying to Render

1. **Database:** apply the migrations to the production database from your machine. Migrations are not run during the Render build.
   ```bash
   npm run prisma:deploy      # uses DIRECT_URL from .env
   npm run seed               # optional: demo data
   ```
2. **Create the service:** either **New → Blueprint** with [`render.yaml`](render.yaml), or **New → Web Service** with:
   - Region: **Singapore** (same region as Neon)
   - Build command: `npm install --include=dev && npx prisma generate && npm run build`
   - Start command: `npm start`
   - Health check path: `/api/v1/health`
3. **Environment variables:** in the Render dashboard, set every variable from the table above. Use `NODE_ENV=production` and add `NODE_VERSION=22`. The secrets are `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` and `OPENROUTER_API_KEY`.
4. **Check it:** open `https://<service>.onrender.com/api/v1/health`. The live instance is at `https://easybook-api-d89z.onrender.com/api/v1`.

**Cold starts:** the free tier sleeps after about 15 minutes idle, and the first request then takes **30–50 seconds**. Open `/api/v1/health` a minute before a demo or review to wake it up.

## Assumptions

- **Customers only.** The spec defines no admin, staff or provider role. Availability belongs to the **service**: one service can't be booked twice at the same time, but one user can book two different services at overlapping times.
- **Services are read-only through the API.** They are managed with the seed script (`isActive = false` retires one).
- **New bookings are `PENDING`.** No confirmation flow is in scope. `CONFIRMED` and `COMPLETED` exist for seed and demo data, and only `PENDING` bookings can be cancelled.
- **Opening hours:** open every day, 09:00–18:00 **Asia/Dhaka**, with 30-minute slots. A booking must start on a slot and finish by closing time. Prices are in **BDT**.
- **No booking horizon:** any future date can be booked.

## Design decisions

### Authentication: stateless JWT
- Login returns a JWT (HS256, 7 days) signed with `JWT_SECRET`. `authenticate` verifies it with the algorithm pinned, and expired or invalid tokens return 401. Logging out means deleting the token on the device.
- Passwords are hashed with bcrypt (cost 10). The hash is never selected for responses: every user query uses a fixed public field list.
- Login gives the same "Invalid email or password" for an unknown email and a wrong password. An unknown email still runs a bcrypt comparison, so response times give nothing away either.
- **Trade-off:** tokens can't be revoked before they expire, including after a password change. A `tokenVersion` column checked in `authenticate` would fix that. It was left out to keep things simple.

### Double-booking protection: two layers
1. **Application layer** (`appointments.service.ts`): inside a transaction, look for a non-cancelled booking of the same service where `existing.start < new.end AND existing.end > new.start`. If one exists, return **409**. This catches almost every conflict with a clear message.
2. **Database layer** (hand-written migration): a Postgres **exclusion constraint**:
   ```sql
   EXCLUDE USING gist ("serviceId" WITH =, tstzrange("startTime","endTime",'[)') WITH &&) WHERE (status <> 'CANCELLED')
   ```
   - **Why:** two requests that arrive at the same moment can both pass the check in layer 1. The constraint makes Postgres reject the second insert (error `23P01`), which the service turns into the same 409.
   - **Proof:** the concurrency test fires 5 simultaneous requests. Exactly one succeeds, and during development the 4 rejections were seen coming from this constraint.
   - **Details:** `'[)'` means back-to-back slots (10:00–10:30 and 10:30–11:00) don't overlap. Cancelled bookings are ignored, which frees their slot. Prisma can't express this constraint, so it's plain SQL.

### Time handling: UTC everywhere
- The database stores `timestamptz`, and the API sends and receives ISO 8601 UTC. Only business hours are local (`BUSINESS_TIMEZONE`).
- `src/utils/time.ts` converts with the built-in `Intl` API (no date library). It also handles zones with daylight saving time, which a test covers.
- Availability and booking use the **same rule function** (`getSlotProblem`), so a slot shown as available can always be booked unless someone takes it first.

### AI assistant: key on the server
- **Prompt:** on every request, the server loads the active services from the database and puts them in the system prompt. The prompt says: answer only from this list, mention price and duration, decline off-topic questions, and ignore attempts to override these rules.
- **Limits:**
  - Only the last 10 history messages are sent, and messages are capped at 500 characters.
  - The request times out after 15 seconds (`AbortController`).
  - The rate limit is 10 messages per minute per user.
- **Errors:** a provider error, rate limit or timeout becomes a friendly 502 or 503. Provider details and the key are never returned or logged.
- **Free models:**
  - **Rate limits:** free models are often rate-limited, so `OPENROUTER_MODELS` is a fallback list that OpenRouter tries in order.
  - **Reasoning off:** reasoning is disabled. With it on, free "thinking" models spent about 15 seconds and the whole token budget before answering.
- **Suggested services:** `suggestedServices` comes from matching service names in the reply. That's more reliable than asking a free model for JSON.
- **Swapping provider:** all provider code is in one section of `ai.service.ts`, so switching to Gemini or OpenAI means changing only that part.

### Why feature-based folders
- Each feature is self-contained: routes, controller, service, validation, types and tests. That makes it easy to find, review and explain one feature at a time.
- There is deliberately **no repository layer or dependency injection**. Services call Prisma directly, which keeps the code short for a project this size.

### Other decisions
- **One response shape:** `{ success, data, message?, meta? }` for success and `{ success: false, message, errors? }` for errors. One central `errorHandler` maps `ApiError`, Zod errors (422 with per-field `errors`), Prisma errors, bad JSON and unknown errors. Stack traces never reach the client.
- **404, not 403,** for someone else's booking, so the API never confirms that another user's booking id exists. A malformed id in the URL is also a 404.
- **Prices are strings** with two decimals (`"500.00"`) to avoid floating-point rounding.
- **`CORS_ORIGIN=*`:** mobile apps don't use CORS, and the API uses Bearer tokens, not cookies. A comma-separated list restricts browser clients if a web app is ever added.
- **Rate limits:** general (300 per 15 minutes per IP), auth and change password (20 per 15 minutes per IP), AI (10 per minute **per user**, because mobile carriers often share one IP across many phones). `trust proxy` is set to 1, so Render's proxy doesn't hide client IPs.
- **Validation everywhere:** every body and query is validated with Zod. Strict schemas reject unknown fields, for example `email` or `passwordHash` on a profile update.

## Known limitations

- Tokens can't be revoked before they expire (see Authentication).
- No admin API: services and booking confirmations are managed through the seed or the database.
- **Typed request parsing:** controllers read the request with a type cast (`req.body as RegisterInput`). This is safe because the `validate` middleware has already parsed the request with the same Zod schema, but TypeScript can't prove that link.
- **`npm audit` warnings:** it reports `deepmerge-ts` inside Prisma 6's config loader. That code runs only while loading Prisma's configuration and never handles request data. The fix is the breaking Prisma 7 upgrade, which was deliberately postponed.
