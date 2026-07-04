# Second Brain — Project Architecture

A native iOS task & productivity app inspired by [TickTick](https://ticktick.com), backed by a
**custom NestJS + Postgres** API. Built **offline-capable** (a local on-device store + on-device
alarms/geofences) with a pragmatic **online-first** sync model to start. This document is the
**north-star architecture** — it describes the target design. Sections marked _(planned)_ are the
destination; keep this file in sync as code lands.

> This is a monorepo: the iOS app lives in `ios/`, the backend in `server/`, and a web client in
> `web/` (see §9). iOS is the primary, offline-capable app; web is an online-first companion.

---

## 1. Product Vision

A "second brain" for capturing, organizing, and completing work — primarily used on iPhone,
usable offline for its core loop, syncing across the user's devices and (eventually) shared with
other people. TickTick is the reference for the initial feature set; the design is modular so
features can be added, removed, or reshaped over time.

### Core concepts

| Concept       | Description                                                            |
| ------------- | --------------------------------------------------------------------- |
| **Task**      | Atomic unit of work — title, notes, due date, priority, status.       |
| **Subtask**   | A checklist item nested under a task.                                  |
| **List**      | A named list that groups tasks (TickTick "lists"). Shareable. Swift type `TaskList` (avoids clashing with SwiftUI's `List`); table `lists`. |
| **Tag**       | A cross-cutting label; a task can have many.                          |
| **Smart list**| Derived view (a computed list): Inbox, Today, Next 7 Days, Completed, Tag view. |
| **Priority**  | None / Low / Medium / High.                                           |
| **Reminder**  | Time-based **local notification** fired on-device.                    |
| **Geo-reminder** | Location-triggered reminder via on-device geofencing.              |
| **Recurrence**| Rule that regenerates a task on a schedule.                           |
| **Share**     | A list shared with other users (collaboration).                       |

---

## 2. Key Architectural Decisions

These are settled decisions. Change them deliberately.

1. **Native iOS (Swift + SwiftUI).** Chosen for maximum OS support — precise alarms, background
   location/geofencing, notifications, widgets. No cross-platform UI framework.
2. **Custom backend: NestJS (TypeScript) + Postgres.** A real central server is required because
   the app is **collaborative/multi-user**, and we own it end-to-end (no managed-BaaS lock-in or
   per-seat sync bills). Postgres also keeps the door open to a future web/Android client on the
   same API.
3. **Local store on-device (GRDB / SQLite) is the UI's source of truth for reads.** The app reads
   and renders from the local store, so the UI is instant and works with no network. This is what
   makes the core loop offline-capable.
4. **Online-first sync to start; a real sync engine comes later.** Writes are applied locally
   (optimistic) and pushed to the API; on launch/foreground the app pulls the latest and upserts
   into the local store. A robust bidirectional, conflict-resolving sync engine is an **explicit
   later milestone** (§8, §10) — we do not build it into the foundation.
5. **OS integrations are on-device, not backend.** Alarms (`UNUserNotificationCenter`) and
   geofences (`CLLocationManager`) are scheduled locally from task data in the local store. The
   backend only stores *what* the reminder is; iOS fires it. So the backend never blocks these
   features — reminders fire even fully offline.
6. **Authorization lives in the API.** The NestJS layer enforces all access (per-user + shared-list
   roles). The client is never trusted. `updated_at` is maintained everywhere to support
   last-write-wins when the sync engine lands.
7. **Web is an online-first companion, not a second local-first app.** The web client (`web/`) is
   the same API's browser view for capture/organize/triage. It has **no local store** — server
   state lives in a query cache (TanStack Query), and it calls the API directly (§8). Native-only
   features (on-device reminders, geofences) are intentionally **out of scope for web**. This keeps
   the local-first machinery (§3, §7) an iOS concern and avoids reimplementing sync in the browser.

---

## 3. System Overview

```
┌──────────────────────── iPhone / iPad ─────────────────────────┐
│  SwiftUI Views                                                 │
│      │                                                         │
│  ViewModels (MVVM, @Observable)                                │
│      │                                                         │
│  Repositories ──► GRDB local store (SQLite) ◄─ UI source of    │
│      │                    ▲                     truth (reads)  │
│      ├─► NotificationService → UNUserNotificationCenter        │
│      ├─► LocationService     → CLLocationManager (geofencing)  │
│      └─► ApiClient ───────────► HTTPS + JWT ───────┐           │
└────────────────────────────────────────────────────│───────────┘
                                                     ▼
┌──────────────────────── NestJS API (server/) ──────────────────┐
│  Controllers → Services → Prisma                               │
│  Auth: JWT (access + refresh), bcrypt password hashing         │
│  Guards / policies: per-user + shared-list authorization       │
└───────────────────────────────│────────────────────────────────┘
                                ▼
                Postgres  (users, lists, tasks, tags, …)
```

**Read/write flow (online-first phase):** the UI reads from the **local store**. A write updates
the local store immediately (optimistic) and is pushed to the API; a best-effort outbox retries
pushes that fail while offline. On launch/foreground the app pulls the latest from the API and
upserts into the local store.

---

## 4. Tech Stack

### iOS app (`ios/`)

| Layer            | Choice                              | Notes                                             |
| ---------------- | ----------------------------------- | ------------------------------------------------- |
| Language         | **Swift**                           | Modern concurrency (`async/await`).               |
| UI               | **SwiftUI**                         | `UIKit` only where SwiftUI can't reach.           |
| Local store      | **GRDB** (SQLite)                   | On-device source of truth for reads; reuses §5 schema. |
| Networking       | **URLSession** + a thin `ApiClient` | Talks to the NestJS API over HTTPS with a JWT.    |
| Notifications    | **UserNotifications**               | Local scheduled alarms/reminders.                 |
| Location         | **CoreLocation** (region monitoring)| Geofenced reminders.                              |
| Background work  | **BGTaskScheduler**                 | Periodic pull / maintenance.                      |
| Token storage    | **Keychain**                        | Access + refresh tokens.                          |
| Architecture     | **MVVM + Repository**               | See §7. (TCA optional later if complexity grows.) |

### Backend (`server/`)

| Layer            | Choice                              | Notes                                             |
| ---------------- | ----------------------------------- | ------------------------------------------------- |
| Runtime / lang   | **Node + TypeScript**               | Shared language with the web client (`web/`).     |
| Framework        | **NestJS**                          | Structured modules, DI, guards, pipes.            |
| Database         | **Postgres**                        | Schema of record (§5). Hosted on Neon/Railway/Fly or local Docker. |
| ORM / migrations | **Prisma**                          | Type-safe client + versioned migrations.          |
| Auth             | **JWT (access + refresh)**          | Passport + `bcrypt` password hashing.             |
| Validation       | **class-validator / DTOs**          | Validate every request body.                      |
| Push (later)     | **APNs** from the API               | For shared-list activity while the app is closed. |

### Web app (`web/`)

| Layer            | Choice                              | Notes                                             |
| ---------------- | ----------------------------------- | ------------------------------------------------- |
| Language / build | **TypeScript + Vite**               | SPA; pinned to Vite 6 (Rollup) for the local Node.|
| UI               | **React**                           | Function components + hooks.                       |
| Server state     | **TanStack Query**                  | Cache + mutations; the web analog of §7's repos.  |
| Networking       | **fetch** + a thin client           | `credentials: 'include'`; 401 → refresh → retry.  |
| Auth (browser)   | **httpOnly refresh cookie**         | Access token in memory only; refresh never in JS. |
| Local store      | **none** (online-first)             | No offline store — see §2 decision 7, §8.         |

---

## 5. Data Model

Postgres is the schema of record. The iOS local store (GRDB) mirrors the same tables (minus
`password_hash`), so the two stay structurally aligned. All mutable tables carry `updated_at`
(for eventual last-write-wins) and `created_at`.

```
users            (id, email UNIQUE, password_hash, display_name, avatar_url,
                  created_at, updated_at)

list_groups      (id, owner_id → users, name, sort_order, created_at, updated_at)

lists            (id, owner_id → users, group_id?, name, color, is_inbox,   -- Swift type: TaskList
                  sort_order, created_at, updated_at)

list_members     (list_id → lists, user_id → users, role,      -- SHARING / collaboration
                  created_at, updated_at)                       -- role: 'owner' | 'editor' | 'viewer'

tasks            (id, list_id → lists, created_by → users, title, notes, status,
                  priority, due_at?, remind_at?, recurrence_rule?,
                  geo_lat?, geo_lng?, geo_radius?, geo_trigger?,     -- geofence
                  completed_at?, sort_order, created_at, updated_at)

subtasks         (id, task_id → tasks, title, is_done, sort_order, created_at, updated_at)

tags             (id, owner_id → users, name, color, created_at, updated_at)

task_tags        (task_id → tasks, tag_id → tags)           -- many-to-many
```

**Enums / conventions**
- `status`: `todo` | `in_progress` | `done`.
- `priority`: `none` | `low` | `medium` | `high`.
- `recurrence_rule`: RFC 5545 RRULE string (parsed client-side).
- `geo_trigger`: `on_enter` | `on_exit`.
- IDs are **client-generatable UUIDs**, so the app can create rows offline and `POST` them
  idempotently (the server accepts the client's id).
- Every mutable table has `created_at` + `updated_at`; the server sets `updated_at` on write, and
  the client tracks it locally for the future sync engine.
- On signup the API creates the user's **Inbox** list (`is_inbox = true`) — the list the Inbox
  smart list reads from.

### Smart lists (not tables — local queries over the store)

| Smart list  | Definition                                             |
| ----------- | ------------------------------------------------------ |
| Inbox       | Tasks in the user's `is_inbox` list.                   |
| Today       | `due_at` ≤ end of today AND status ≠ done.             |
| Next 7 Days | `due_at` within 7 days AND status ≠ done.              |
| Completed   | `status = done`, ordered by `completed_at`.            |
| Tag view    | Tasks joined to a given tag.                           |

---

## 6. Security & Authorization (in the API)

Authorization is enforced **server-side in NestJS** (guards + policy checks), not in the database
and never on the client. The access model:

- Authenticated requests carry a **JWT access token**; a refresh token mints new access tokens.
  Passwords are hashed with `bcrypt`.
- **Token delivery is per-client.** iOS receives both tokens in the JSON body (Keychain). The web
  client receives the refresh token as an **httpOnly / SameSite cookie** and keeps only the access
  token in memory, so no token is exposed to JS. `POST /auth/refresh` reads the cookie or falls
  back to the body — one endpoint, both clients. CORS is restricted to the configured web origin.
- A user can access a `list` if they are the `owner_id` **or** appear in `list_members` for that
  list.
- `tasks` / `subtasks` / `task_tags` inherit access from their parent `list`.
- Write scope depends on `list_members.role` (`viewer` = read-only, `editor`/`owner` = write).
- `tags` and `list_groups` are private to their `owner_id`.
- Every endpoint validates its request body (DTOs) and re-checks ownership on the server — the
  client id in a payload is never trusted for authorization.

---

## 7. App Architecture (MVVM + Repository)

```
Views (SwiftUI)            – dumb, declarative; bind to a ViewModel
   │
ViewModels                 – presentation state + intent; @Observable/@MainActor
   │
Repositories               – the ONLY things that touch the local store; also
   │   TaskRepository, TaskListRepository, TagRepository …   orchestrate API push/pull
   │
GRDB local store (SQLite)  – UI source of truth for reads
   +
Services (cross-cutting)
   ├─ ApiClient            – typed HTTPS calls to the NestJS API (attaches JWT)
   ├─ AuthService          – sign-in/up, holds session, refreshes tokens (Keychain)
   ├─ SyncService          – pull-on-launch/foreground + best-effort write outbox
   ├─ NotificationService  – schedule/cancel local notifications for remind_at
   └─ LocationService      – register/tear down geofences for geo-reminders
```

**Rules**
- Views never call the DB, `ApiClient`, or a service directly — always through a ViewModel.
- Repositories return domain models and hide GRDB/SQL and networking details. A write goes:
  ViewModel → Repository → (local store now) + (API push via `SyncService`).
- When a task's `remind_at` / geofence fields change, the repository (or a coordinator) tells
  `NotificationService` / `LocationService` to reconcile on-device schedules. Keep the OS schedule
  derived from local-store state, so it self-heals after a pull.
- iOS caps active geofences at **20 per app** — monitor only the nearest/most-relevant regions.

---

## 8. Sync Strategy

**Now — online-first:**
- **UI source of truth:** the local GRDB store. Reads never block on the network.
- **Writes:** applied to the local store immediately (optimistic), then pushed to the API. A
  best-effort **outbox** retries pushes that failed while offline.
- **Pull:** on launch and foreground, `GET` the user's data (or `GET /changes?since=<updated_at>`
  once available) and upsert into the local store.
- **Conflict handling:** minimal for now (last writer to the server wins). Because a task app's
  edits rarely truly collide, this is acceptable for a single user across devices.

**Web client — online-first, no local store.** The above local-first flow is an **iOS** concern.
The web app (`web/`) reads and writes straight through the API, with **TanStack Query** as its
server-state cache (queries + mutation invalidation) instead of GRDB. It has no offline mode and
does not participate in the sync engine (§2 decision 7).

**Later _(planned)_ — a real sync engine:**
- A scoped, custom **last-write-wins** protocol: `GET /changes?since=` pull + push of locally
  "dirty" rows, keyed on `updated_at`, with **soft-delete tombstones** so deletes propagate.
- Local bookkeeping columns (`dirty`, `deleted_at`) added to the store when this lands.
- `BGTaskScheduler` for periodic background pulls.
- Real-time collaboration (push-driven updates) is a further step beyond this.

---

## 9. Suggested Repository Structure (monorepo)

```
SecondBrain-iOS/
├── ios/                                 # the Xcode app
│   ├── SecondBrain.xcodeproj
│   └── SecondBrain/
│       ├── App/
│       │   ├── SecondBrainApp.swift     # @main, DI container / app bootstrap
│       │   └── AppEnvironment.swift     # shared services, config
│       ├── Features/                    # one folder per feature (view + viewmodel)
│       │   ├── TaskList/                # the task-list *screen* (a UI view)
│       │   ├── TaskDetail/
│       │   ├── Lists/                   # managing List entities (TaskList)
│       │   ├── SmartLists/
│       │   └── Auth/
│       ├── Domain/
│       │   └── Models/                  # Task, TaskList, Tag, … (plain Swift types)
│       ├── Data/
│       │   ├── Repositories/            # protocols + GRDB-backed implementations
│       │   ├── Persistence/             # GRDB Database, migrations, record types (DAOs)
│       │   └── Api/                     # ApiClient, DTOs, endpoints
│       ├── Services/
│       │   ├── Sync/                    # pull-on-launch + write outbox
│       │   ├── Auth/                    # session + token refresh (Keychain)
│       │   ├── Notifications/           # UNUserNotificationCenter wrapper
│       │   └── Location/                # CoreLocation geofencing
│       ├── DesignSystem/                # reusable SwiftUI components, colors, type
│       └── Resources/                   # assets, localizable strings
│
├── server/                             # the NestJS API
│   ├── prisma/
│   │   ├── schema.prisma                # models mirroring §5
│   │   └── migrations/                  # versioned SQL
│   └── src/
│       ├── auth/                        # JWT + refresh; JSON body (iOS) & cookie (web)
│       ├── users/                       # GET /users/me
│       ├── lists/                       # lists + list_members (sharing)
│       ├── tasks/                       # tasks + subtasks
│       ├── tags/
│       ├── access/                      # API-layer authorization helpers (§6)
│       └── common/                      # DTOs, pipes, decorators
│
└── web/                               # the React SPA (online-first companion, §2.7)
    ├── index.html
    └── src/
        ├── api/                        # fetch client, types, TanStack Query hooks
        ├── auth/                       # AuthContext (cookie-based session restore)
        └── pages/                      # LoginPage, AppPage
```

> The former `supabase/` directory (Postgres schema + RLS + PowerSync sync rules) is retained in
> git history as reference for the earlier Supabase + PowerSync design, which was replaced by this
> stack. Its SQL schema informed `prisma/schema.prisma`.

---

## 10. Feature Roadmap

Each phase keeps the app runnable and, where relevant, touches backend + app together (vertical
slices).

1. **Backend foundation (NestJS)** — project, Postgres + Prisma, the §5 schema, JWT auth
   (signup/login/refresh), CRUD for lists/tasks with §6 authorization; signup creates Inbox.
2. **iOS skeleton** — Xcode project, GRDB local store, sign-in against the API, render tasks from
   the local store; write-through + pull-on-launch wired.
3. **Tasks CRUD** — create/edit/complete/delete against the local store; pushed to the API.
4. **Reminders / alarms** — `remind_at` → local notifications. _(Validate this early — core value.)_
5. **Lists & Inbox** — group tasks; move between lists; sidebar/list nav.
6. **Smart lists** — Today / Next 7 Days / Completed.
7. **Tags & filtering.**
8. **Location reminders** — geofenced notifications.
9. **Subtasks / checklists.**
10. **Custom sync engine** — LWW `changes-since` protocol + tombstones + background pulls (§8).
11. **Sharing / collaboration** — invite users to a list; role-based access; (later) real-time.
12. **Recurrence** — repeating tasks.
13. **Nice-to-haves** — drag reorder, widgets, focus timer, calendar view, Android client.
    _(A web companion — `web/`, online-first triage — already shipped ahead of this list; §2.7.)_

---

## 11. Conventions

- **Client-generatable UUIDs** for all rows (offline creation; idempotent `POST`).
- **Always set/track `updated_at`** on writes; prefer field-level updates over whole-row overwrites.
- **Repositories are the only local-store boundary**; Views/ViewModels stay persistence- and
  network-agnostic.
- **Derive OS schedules from local-store state** (notifications/geofences), so they reconcile after
  a pull.
- **Authorization is server-side** — never rely on the client to enforce access; re-check ownership
  on every endpoint.
- **Secrets** (API base URL, signing keys) via config/xcconfig on iOS and `.env` on the server —
  never committed. Only non-secret config ships in the app.

---

## 12. Open Questions / To Decide

- Postgres hosting for dev/prod (Neon vs Railway vs Fly vs local Docker).
- ~~Refresh-token strategy~~ — **decided:** DB-backed `refresh_tokens` table with rotation +
  revocation; web uses an httpOnly cookie, iOS the JSON body (§6).
- Recurrence representation — full RRULE vs. a simpler custom JSON shape.
- Shape of the `changes-since` sync API before building the sync engine (§8/§10 item 10).
- Push (remote) notifications for shared-list activity — APNs from the NestJS API (local
  notifications don't cover "someone edited a shared task while app closed").
- Whether to adopt TCA instead of plain MVVM if state complexity grows.
- Widget / Live Activity scope for reminders.
</content>
