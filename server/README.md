# Second Brain — Server (NestJS + Postgres)

The backend API for Second Brain. NestJS + Prisma + Postgres, JWT auth, per-user /
shared-list authorization enforced in the API layer (see [ARCHITECTURE.md](../ARCHITECTURE.md)
§4, §6, §9).

## Setup

```bash
cd server
npm install
cp .env.example .env          # fill in DATABASE_URL + JWT secrets
npm run prisma:generate       # generate the Prisma client
npm run prisma:migrate        # apply migrations to your Postgres (needs a live DB)
npm run start:dev             # http://localhost:3000/api
```

No Postgres yet? Spin one up locally:

```bash
docker run --name sb-postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=secondbrain -p 5432:5432 -d postgres:16
```

## Layout (§9)

```
prisma/
  schema.prisma        # data model (§5), ported from the old supabase/ schema
  migrations/          # versioned SQL (incl. the one-Inbox-per-owner partial index)
src/
  prisma/              # PrismaService (the DB boundary)
  config/              # env validation
  auth/                # signup / login / refresh (JWT + bcrypt); JwtStrategy + guard
  access/              # AccessService — API-layer port of the Supabase RLS policies
  lists/               # lists + list_members (sharing)
  tasks/               # tasks + subtasks
  tags/                # tags + task_tags links
  common/              # decorators (@CurrentUser), shared helpers
```

## How the Supabase design was reused

Phase 1 shipped a Supabase (Postgres + RLS + PowerSync) design under `../supabase/`. This
server ports that design to the owned NestJS stack:

| Supabase artifact | Here |
| --- | --- |
| `init_schema.sql` tables + enums | `prisma/schema.prisma` (1:1) |
| `auth.users` + `profiles` | folded into one `users` table (we own auth now) |
| `set_updated_at` trigger | Prisma `@updatedAt` |
| RLS policies + `can_read/write_*` SECURITY DEFINER helpers | `access/access.service.ts` — enforced in every service, since NestJS connects as one DB role (authz lives in the API, §6) |
| `handle_new_user` bootstrap trigger | `AuthService.signup` creates the user's Inbox list in a transaction |
| `lists_one_inbox_per_owner` partial unique index | preserved in the init migration SQL |
| PowerSync denorm (`list_id` on children) + `sync-rules.yaml` | dropped — no PowerSync in this stack |

## API surface

- `POST /api/auth/signup` · `POST /api/auth/login` · `POST /api/auth/refresh` · `POST /api/auth/logout`
- `GET/POST /api/lists`, `GET/PATCH/DELETE /api/lists/:id`
- `GET/POST /api/lists/:id/members`, `PATCH/DELETE /api/lists/:id/members/:userId`
- `GET /api/tasks?listId=`, `POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/:id`
- `GET/POST /api/tasks/:id/subtasks`, `PATCH/DELETE /api/tasks/:id/subtasks/:subtaskId`
- `GET/POST /api/tags`, `PATCH/DELETE /api/tags/:id`
- `POST /api/task-tags`, `DELETE /api/task-tags/:taskId/:tagId`

All routes except `auth/*` require a `Bearer <accessToken>` header.
