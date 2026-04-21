# K-12 SIS / Gradebook API

K-12 student information system and gradebook REST API with a FERPA-aligned audit trail. Built with Node.js (no framework), Drizzle ORM, and PostgreSQL.

## Prerequisites

- Node.js ≥ 22.12 (required for `--experimental-strip-types` and `node:module/stripTypeScriptTypes`)
- PostgreSQL database
- pnpm

## Quick start

```sh
# 1. Install dependencies
pnpm install

# 2. Point at a Postgres database
export DATABASE_URL="postgres://user:pass@localhost:5432/k12_dev"

# 3. Generate + apply migrations
pnpm db:generate
pnpm db:migrate

# 4. Start the dev server (hot-reload via --watch)
pnpm dev
# → listening on port 8103

# 5. Verify the scaffold
curl http://localhost:8103/health
# → {"status":"ok","service":"starter-foundry-k12"}
```

## Typecheck

```sh
npx tsc --noEmit
```

No build step is needed — the server runs TypeScript directly via Node's strip-types loader.

## API routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| POST | `/api/classes` | Create a class (requires `teacherId`) |
| GET | `/api/classes/:id/roster` | Active enrollments for a class |
| POST | `/api/classes/:id/assignments` | Create an assignment |
| POST | `/api/assignments/:id/submissions` | Submit work for an assignment |
| POST | `/api/submissions/:id/grade` | Grade a submission (teacher/admin only) |
| GET | `/api/students/:id/grades` | Fetch a student's grades — **FERPA audit-logged** |

Pass actor identity on every request via headers:
- `x-actor-id`: actor UUID (teacher UUID or parent UUID)
- `x-actor-role`: `teacher` | `admin` | `parent` | `student`
- `x-access-reason` *(optional)*: free-text reason recorded in the audit log

## Data model

`Student → Enrollment → Class ← Teacher`  
`Enrollment → Assignment → Submission → Grade`  
`Parent → ParentStudent → Student`  
`GradeAccessLog` — one row written **before** each grade disclosure (FERPA §99.32)

## FERPA notes

- Every call to `GET /api/students/:id/grades` writes a `GradeAccessLog` row before returning data. **Do not remove or async-detach this write.**
- Parent access is gated by `ParentStudent.canAccessGrades` AND `ParentStudent.custodialRights`. Non-custodial parents must have `custodialRights = false`.
- Grades are immutable: amendments are new `Grade` rows with `amendmentOfGradeId` pointing to the prior row, never `UPDATE`s.
- Student PII (names, grades) must not appear in stdout logs or error-tracking payloads.

## Extending

| What | Where |
|------|-------|
| Add tables | `src/db/schema.ts` |
| New API routes | `src/api/` + wire in `src/server.ts` |
| SIS import adapter (OneRoster / Clever) | `src/sis/` |
| Background jobs (grade aggregation, reports) | `src/jobs/` |
