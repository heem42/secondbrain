# Second Brain

A "second brain" for capturing, organizing, and completing work — a native **iOS** app plus a
**web** companion, both backed by a custom **NestJS + Postgres** API. The iOS app is offline-capable
with on-device reminders and geofences; the web app is an online-first companion for capture and
triage.

> This is the project overview. For the design rationale and target architecture, see
> **[ARCHITECTURE.md](ARCHITECTURE.md)** — the north-star doc.

---

## Highlights

- **One API, three surfaces.** A single authorized REST API serves the native app, the web app, and
  (eventually) collaborators.
- **Offline-capable iOS.** The app reads and writes a local **GRDB/SQLite** store as its source of
  truth, so the core loop works with no network; changes sync online-first.
- **Native OS integration.** Time-based reminders fire on-device via `UNUserNotificationCenter`,
  even fully offline. Location reminders (geofences) are on the roadmap.
- **Authorization in the API.** All access control — per-user and shared-list roles — is enforced
  server-side in NestJS. Clients are never trusted.
- **Secure auth per client.** JWT access + refresh tokens; iOS stores them in the Keychain, and the
  web app keeps the refresh token in an httpOnly cookie (access token in memory only).

---

## Monorepo layout

```
SecondBrain-iOS/
├── server/   # NestJS + Prisma + Postgres API (schema of record, auth, authorization)
├── ios/      # Native SwiftUI app (MVVM + Repository, GRDB local store)
├── web/      # React + Vite SPA (online-first triage companion)
└── ARCHITECTURE.md
```

## Tech stack

| Surface     | Stack                                                                        |
| ----------- | ---------------------------------------------------------------------------- |
| **API**     | Node · TypeScript · NestJS · Prisma · Postgres · JWT (Passport + bcrypt)      |
| **iOS**     | Swift · SwiftUI · GRDB (SQLite) · URLSession · UserNotifications · Keychain   |
| **Web**     | TypeScript · React · Vite · TanStack Query                                    |

---

## Getting started

### 1. API (`server/`)

Needs a Postgres database. The quickest local option is Docker:

```bash
docker run --name sb-postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=secondbrain -p 5432:5432 -d postgres:16
```

Then:

```bash
cd server
npm install
cp .env.example .env          # fill in DATABASE_URL + JWT secrets
npm run prisma:generate
npm run prisma:migrate        # apply the schema
npm run start:dev             # http://localhost:3000/api
```

See [server/README.md](server/README.md) for the full API surface and details.

### 2. Web app (`web/`)

```bash
cd web
npm install
npm run dev                   # http://localhost:5173
```

The dev server proxies to the API at `http://localhost:3000/api` (override with
`VITE_API_BASE_URL`). Sign up, or sign in with an account created via the API.

### 3. iOS app (`ios/`)

The Xcode project is generated from `project.yml` with [XcodeGen](https://github.com/yonaskolb/XcodeGen):

```bash
cd ios
brew install xcodegen          # once
xcodegen generate              # produces SecondBrain.xcodeproj
open SecondBrain.xcodeproj      # then run on a simulator (⌘R)
```

The app targets the API at `http://localhost:3000/api` by default (configurable in `project.yml`).

---

## Data model (short version)

Postgres is the schema of record; the iOS local store mirrors it (minus `password_hash`).
Core tables: `users`, `list_groups`, `lists`, `list_members` (sharing), `tasks`, `subtasks`,
`tags`, `task_tags`. IDs are client-generatable UUIDs so rows can be created offline and `POST`ed
idempotently. Full details in [ARCHITECTURE.md §5](ARCHITECTURE.md).

## Status & roadmap

Early and under active development. Shipped so far:

- ✅ **Backend foundation** — schema, JWT auth (signup/login/refresh), CRUD for lists/tasks with
  server-side authorization; signup bootstraps an Inbox.
- ✅ **iOS skeleton** — GRDB store, sign-in, render from the local store, pull-on-launch.
- ✅ **Task CRUD** — create / edit / complete / delete, write-through to the API.
- ✅ **Reminders** — `remind_at` → on-device local notifications.
- ✅ **Web companion** — online-first React SPA for capture and triage.

Next up: lists & smart lists (Today / Next 7 Days / Completed), tags, location reminders, subtasks,
a real sync engine, and sharing/collaboration. See the full roadmap in
[ARCHITECTURE.md §10](ARCHITECTURE.md).

---

## Repository conventions

- Work lands via small, focused PRs squash-merged into `main`.
- Secrets live in `.env` (server) / xcconfig (iOS) and are never committed.
- Keep [ARCHITECTURE.md](ARCHITECTURE.md) in sync as the design evolves — it's the source of truth
  for *why*, not just *what*.
