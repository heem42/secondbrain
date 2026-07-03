# Second Brain (iOS) — Project Architecture

A native iOS task & productivity app inspired by [TickTick](https://ticktick.com), built
**offline-first** with deep OS integration (alarms, location-based reminders). This document
is the **north-star architecture** — it describes the target design before implementation.
Sections marked _(planned)_ are the destination; keep this file in sync as code lands.

> Rename to `CLAUDE.md` once the repo is initialized so Claude Code loads it automatically.

---

## 1. Product Vision

A "second brain" for capturing, organizing, and completing work — primarily used on iPhone,
fully functional offline, syncing across the user's devices and (eventually) shared with other
people. TickTick is the reference for the initial feature set; the design is modular so
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

These are settled decisions (see the reasoning in project history). Change them deliberately.

1. **Native iOS (Swift + SwiftUI).** Chosen for maximum OS support — precise alarms, background
   location/geofencing, notifications, widgets. No cross-platform UI framework.
2. **Offline-first.** A local database on-device is the **source of truth**. The app is fully
   usable with no network; sync happens in the background. This is non-negotiable for a task
   app whose reminders must fire offline.
3. **Backend = Supabase (Postgres + Auth + RLS).** A real central server is required because
   the app is **collaborative/multi-user**. Postgres also keeps the door open to a future
   web/Android client on the same backend.
4. **Sync layer = PowerSync.** Supabase alone is online-first; PowerSync provides the
   offline-first sync engine (local SQLite ⇄ Postgres) with a Swift SDK. This is the piece
   that makes decision #2 real.
5. **OS integrations are on-device, not backend.** Alarms (`UNUserNotificationCenter`) and
   geofences (`CLLocationManager`) are scheduled locally from task data. The backend only
   stores *what* the reminder is; iOS fires it. So the backend never blocks these features.
6. **Conflict resolution: last-write-wins per field, plus `updated_at` everywhere.** Prefer
   field-level updates over whole-row overwrites. Full CRDT/real-time co-editing is out of
   scope — task edits rarely truly collide.

---

## 3. System Overview

```
┌──────────────────────────── iPhone / iPad ────────────────────────────┐
│  SwiftUI Views                                                         │
│      │                                                                 │
│  ViewModels (MVVM)                                                     │
│      │                                                                 │
│  Repositories  ──►  Local SQLite (PowerSync SDK)  ◄── SOURCE OF TRUTH  │
│      │                     ▲                                           │
│      ├─► NotificationService  → UNUserNotificationCenter (alarms)      │
│      └─► LocationService      → CLLocationManager (geofencing)         │
│                            │                                           │
│                     PowerSync sync engine                             │
└────────────────────────────│──────────────────────────────────────────┘
                             │  (background delta sync, when online)
                             ▼
┌──────────────────────────── Supabase ─────────────────────────────────┐
│  Postgres (tasks, lists, tags, list_members, …)                       │
│  Auth (users, sessions)                                               │
│  RLS policies (per-user + shared-list access)                         │
│  Edge Functions (only for server-side logic, e.g. remote push)        │
└───────────────────────────────────────────────────────────────────────┘
```

**Read/write flow:** the UI only ever reads from and writes to the **local** SQLite DB, so
every interaction is instant and offline-safe. PowerSync streams local changes up to Postgres
and pulls remote changes down, in the background.

---

## 4. Tech Stack

| Layer               | Choice                                   | Notes                                          |
| ------------------- | ---------------------------------------- | ---------------------------------------------- |
| Language            | **Swift**                                | Modern concurrency (`async/await`).            |
| UI                  | **SwiftUI**                              | `UIKit` only where SwiftUI can't reach.        |
| Local DB / sync     | **PowerSync Swift SDK** (SQLite)         | On-device source of truth + sync engine.       |
| Backend             | **Supabase** (Postgres, Auth, RLS)       | Central store; PowerSync connects to it.       |
| Auth                | **Supabase Auth** (`supabase-swift`)     | Email/OAuth; issues the token PowerSync uses.  |
| Notifications       | **UserNotifications** framework          | Local scheduled alarms/reminders.              |
| Location            | **CoreLocation** (region monitoring)     | Geofenced reminders.                           |
| Background work     | **BGTaskScheduler**                      | Periodic sync / maintenance.                   |
| Architecture        | **MVVM + Repository**                    | See §7. (TCA optional later if complexity grows.) |

---

## 5. Data Model

Postgres is the schema of record; PowerSync mirrors a subset into on-device SQLite via **sync
rules** (§8). All tables carry `updated_at` for conflict resolution and are governed by RLS.

```
auth.users                                   -- Supabase-managed

profiles         (id → users, display_name, avatar_url, updated_at)

list_groups      (id, owner_id, name, sort_order, updated_at)

lists            (id, owner_id, group_id?, name, color, is_inbox,   -- Swift type: TaskList
                  sort_order, updated_at)

list_members     (list_id, user_id, role,              -- SHARING / collaboration
                  created_at, updated_at)               -- role: 'owner' | 'editor' | 'viewer'

tasks            (id, list_id, created_by, title, notes, status,
                  priority, due_at?, remind_at?, recurrence_rule?,
                  geo_lat?, geo_lng?, geo_radius?, geo_trigger?,     -- geofence
                  completed_at?, sort_order, created_at, updated_at)

subtasks         (id, task_id, title, is_done, sort_order, updated_at)

tags             (id, owner_id, name, color, updated_at)

task_tags        (task_id, tag_id)           -- many-to-many
```

**Enums / conventions**
- `status`: `todo` | `in_progress` | `done`.
- `priority`: `none` | `low` | `medium` | `high`.
- `recurrence_rule`: RFC 5545 RRULE string (parsed client-side).
- `geo_trigger`: `on_enter` | `on_exit`.
- IDs are **UUIDs** (client-generated), so the app can create rows offline without server round-trips.
- Every mutable table has `updated_at`; clients set it on write for last-write-wins.

### Smart lists (not tables — local queries)

| Smart list  | Definition                                             |
| ----------- | ------------------------------------------------------ |
| Inbox       | Tasks in the user's `is_inbox` list.                   |
| Today       | `due_at` ≤ end of today AND status ≠ done.             |
| Next 7 Days | `due_at` within 7 days AND status ≠ done.              |
| Completed   | `status = done`, ordered by `completed_at`.            |
| Tag view    | Tasks joined to a given tag.                           |

---

## 6. Security & Sharing (RLS)

Row Level Security is the authorization boundary. Sketch of the policy model:

- A user can access a `list` if they are the `owner_id` **or** appear in `list_members`
  for that list.
- `tasks` / `subtasks` / `task_tags` inherit access from their parent `list`.
- Write scope depends on `list_members.role` (`viewer` = read-only, `editor`/`owner` = write).
- `tags` and `list_groups` are private to their `owner_id`.

RLS is enforced server-side in Postgres; PowerSync's **sync rules** additionally decide which
rows each device downloads (defense in depth + smaller local DB).

---

## 7. App Architecture (MVVM + Repository)

```
Views (SwiftUI)            – dumb, declarative; bind to a ViewModel
   │
ViewModels                 – presentation state + intent; @Observable/@MainActor
   │
Repositories               – the ONLY things that touch the local DB
   │   TaskRepository, TaskListRepository, TagRepository …
   │
PowerSync local SQLite     – source of truth
   +
Services (cross-cutting)
   ├─ NotificationService  – schedule/cancel local notifications for remind_at
   ├─ LocationService      – register/tear down geofences for geo-reminders
   ├─ SyncService          – wraps PowerSync connect/status/auth token refresh
   └─ AuthService          – Supabase Auth session, feeds token to PowerSync
```

**Rules**
- Views never call the DB or a service directly — always through a ViewModel.
- Repositories return domain models and hide SQL/PowerSync details.
- When a task's `remind_at` / geofence fields change, the repository (or a coordinator) tells
  `NotificationService` / `LocationService` to reconcile on-device schedules. Keep the OS
  schedule derived from DB state, so it self-heals after sync.
- iOS caps active geofences at **20 per app** — monitor only the nearest/most-relevant regions.

---

## 8. Sync Strategy

- **Source of truth:** local SQLite. UI reads/writes local only.
- **PowerSync sync rules** define per-user "buckets": a user syncs lists they own or are a
  member of, and the tasks/subtasks/tags under them.
- **Auth:** Supabase Auth issues a JWT; PowerSync uses it to authorize sync and RLS applies.
- **Conflict resolution:** last-write-wins by `updated_at`, applied per field where practical.
  Custom merge logic (if ever needed) lives server-side in Postgres.
- **Offline writes:** queued locally with client-generated UUIDs, replayed on reconnect.
- **Background sync:** `BGTaskScheduler` triggers periodic sync; also sync on foreground.

---

## 9. Suggested Project Structure (Xcode)

```
SecondBrain/
├── App/
│   ├── SecondBrainApp.swift          # @main, DI container / app bootstrap
│   └── AppEnvironment.swift          # shared services, config
├── Features/                         # one folder per feature (view + viewmodel)
│   ├── TaskList/                    # the task-list *screen* (a UI view)
│   ├── TaskDetail/
│   ├── Lists/                        # managing List entities (TaskList)
│   ├── SmartLists/
│   └── Auth/
├── Domain/
│   ├── Models/                       # Task, TaskList, Tag, … (plain Swift types)
│   └── Repositories/                 # protocols + PowerSync-backed implementations
├── Services/
│   ├── Sync/                         # PowerSync setup + sync rules client
│   ├── Notifications/                # UNUserNotificationCenter wrapper
│   ├── Location/                     # CoreLocation geofencing
│   └── Auth/                         # Supabase Auth
├── Persistence/
│   └── Schema.swift                  # local SQLite schema (mirrors Postgres subset)
├── DesignSystem/                     # reusable SwiftUI components, colors, type
└── Resources/                        # assets, localizable strings

supabase/                             # backend as code (can be its own repo)
├── migrations/                       # versioned SQL (schema + RLS)
└── powersync/                        # sync rules definition
```

---

## 10. Feature Roadmap

Each phase keeps the app runnable and touches backend + app together (vertical slices).

1. **Backend foundation** — Supabase schema + RLS + `list_members`; PowerSync sync rules.
2. **iOS skeleton** — Xcode project, Supabase Auth sign-in, PowerSync connected, render tasks
   from the local DB.
3. **Tasks CRUD** — create/edit/complete/delete against local SQLite; sync verified.
4. **Reminders / alarms** — `remind_at` → local notifications. _(Validate this early — core value.)_
5. **Lists & Inbox** — group tasks; move between lists; sidebar/list nav.
6. **Smart lists** — Today / Next 7 Days / Completed.
7. **Tags & filtering.**
8. **Location reminders** — geofenced notifications.
9. **Subtasks / checklists.**
10. **Sharing / collaboration** — invite users to a list; role-based access.
11. **Recurrence** — repeating tasks.
12. **Nice-to-haves** — drag reorder, widgets, focus timer, calendar view, Android/web client.

---

## 11. Conventions

- **Client-generated UUIDs** for all rows (offline creation).
- **Always set `updated_at`** on writes; never overwrite a whole row when a field update suffices.
- **Repositories are the only DB boundary**; Views/ViewModels stay persistence-agnostic.
- **Derive OS schedules from DB state** (notifications/geofences), so they reconcile after sync.
- **RLS is the security boundary** — never rely on the client to enforce access.
- **Secrets** (Supabase keys) via config/xcconfig, not committed. Only the anon/public key ships
  in the app; everything else is protected by RLS + Auth.

---

## 12. Open Questions / To Decide

- Recurrence representation — full RRULE vs. a simpler custom JSON shape.
- Push (remote) notifications for shared-list activity — needs APNs + a Supabase Edge Function
  (local notifications don't cover "someone edited a shared task while app closed").
- Whether to adopt TCA instead of plain MVVM if state complexity grows.
- Widget / Live Activity scope for reminders.
