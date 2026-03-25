# Code Documentation

## Overview

**Vyber předmětů** (Subject Selection) is a SvelteKit web application for managing elective subject enrollment at a school. It uses Supabase for authentication and database, Tailwind CSS for styling, and Svelte 5 with runes for reactivity.

### Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| SvelteKit | 2.43.2 | Full-stack framework |
| Svelte | 5.39.5 | UI framework (runes: `$state`, `$derived`, `$props`) |
| Vite | 7.1.7 | Build tool |
| TypeScript | 5.9.2 | Type safety |
| Tailwind CSS | 4.1.13 | Styling (with forms + typography plugins) |
| Supabase | 2.89.0 | Auth (OTP) + PostgreSQL database |
| xlsx | 0.18.5 | Excel file import/export |

---

## Project Structure

```
src/
├── app.html              # HTML entry point
├── app.css               # Global styles (Tailwind imports)
├── app.d.ts              # Global TypeScript types (App.Locals, App.PageData)
├── hooks.server.ts       # Server hooks (Supabase SSR client, auth)
├── lib/
│   ├── index.ts                    # Shared exports (empty placeholder)
│   ├── subject-sorting.ts          # Core sorting & enrollment algorithm
│   └── supabase-service.server.ts  # Service-role Supabase client
└── routes/
    ├── +layout.server.ts   # Root server load (session/user)
    ├── +layout.svelte      # Root layout (CSS, favicon)
    ├── +layout.ts          # Client-side Supabase + auth dependency
    ├── +page.server.ts     # Home redirect (→ /student or /auth/login)
    ├── +page.svelte        # Fallback home page
    ├── _debug/users/       # Dev-only debug endpoint
    ├── admin/              # Admin dashboard & management
    ├── api/dashboard/      # Voting API (GET subjects, POST preferences)
    ├── auth/               # Authentication (login, logout, role selection)
    ├── student/            # Student dashboard
    ├── teacher/            # Teacher dashboard
    └── voting/             # Voting UI & API
```

---

## Core Library (`src/lib/`)

### `supabase-service.server.ts`

Factory for a Supabase client with **service-role** (admin) privileges. Used for operations that bypass Row Level Security — creating auth users, managing roles, bulk inserts, etc.

```typescript
export function getServiceClient(): SupabaseClient
```

- Requires env variable `SUPABASE_SERVICE_ROLE_KEY`
- Only usable server-side (`.server.ts` files)

---

### `subject-sorting.ts`

Core business logic for the subject selection algorithm. Contains two main algorithms:

#### Types

| Type | Description |
|------|-------------|
| `PreferentialRound` | `{ student_id, subject_id, subject_order }` — one student vote |
| `DivisionConfig` | `{ target_year, column_label, subject_type }` — column configuration |
| `Subject` | `{ id, target_grade, subject_type, teacher_id }` — subject metadata |
| `CategoryKey` | Template string `"OSE_2"`, `"MVOP_3"`, etc. |
| `SortedSubject` | `{ subject_id, points }` — subject with popularity score |
| `SortResult` | `{ ranking, columns }` — full algorithm output |

#### `studentSort(preferentialRound, divisionConfig, subjects) → SortResult`

Sorts subjects by popularity and distributes them into columns.

**Algorithm:**
1. Groups subjects by category (e.g. `OSE_2`, `MVOP_3`)
2. Calculates points per subject: vote at position `k` out of `n` subjects → `n - k + 1` points
3. Sorts subjects by total points per category (descending)
4. Distributes into columns using **snake draft** pattern (A→B→C→C→B→A) for fairness

**Returns:**
- `ranking` — subjects ordered by popularity per category
- `columns` — subjects assigned to columns (keys like `"OSE_3_A"`, `"OSE_3_B"`)

#### `enrollStudents(columns, preferences, subjects, divisionConfig) → Enrollment[]`

Assigns students to subjects based on their preferences and the column structure.

**Algorithm:**
- For each category, per student:
  - Single column → student gets their highest-preferred subject from that column
  - Multiple columns → student gets highest-preferred subject from **each** column
- All enrollments start with status `'waitlisted'`

---

## Authentication

### Flow

```
User enters email → OTP sent via Supabase Auth → User enters 6-digit code
→ Verified → Roles checked → Redirect to dashboard
```

### `hooks.server.ts`

Runs before every server request. Sets up:
- `locals.supabase` — Supabase client with cookie-based session management
- `locals.safeGetSession()` — safely retrieves authenticated user (validates via `supabase.auth.getUser()`)

### `+layout.server.ts` / `+layout.ts`

- Server: extracts `session` and `user` from `safeGetSession()`, passes to all pages
- Client: creates browser Supabase client, establishes `depends('supabase:auth')` for reactivity

### `auth/login/`

**Server actions:**
- `sendOtp` — validates email against `users` table whitelist, sends OTP. If auth user doesn't exist in Supabase Auth, auto-creates one via service role
- `verifyOtp` — verifies 6-digit code, fetches user roles. Single role → redirect to dashboard. Multiple roles → redirect to `/auth/select-role`

**UI:**
- Step 1: Email input
- Step 2: 6-digit OTP input with auto-formatting

### `auth/select-role/`

Shown when a user has multiple roles (e.g. teacher + admin). Displays role buttons, redirects to the matching dashboard (`/student`, `/teacher`, `/admin`).

### `auth/logout/`

POST endpoint — calls `supabase.auth.signOut()`, returns JSON.

---

## Routes

### Home (`/`)

Redirect-only page:
- Authenticated → `/student`
- Not authenticated → `/auth/login`

---

### Student Dashboard (`/student`)

#### Server (`+page.server.ts`)

Loads everything the student needs:
1. Authenticates user, verifies `student` role
2. Calculates student grade from `graduation_year` (August cutoff for school year)
3. Grade 4 → special handling (no voting, only enrollments)
4. Checks `subjects_published` table to see if subjects are visible
5. Loads voting window for student's target year
6. Fetches all **accepted** subjects for their grade
7. Per subject type, checks if student already voted (`preferential_round`)
8. Fetches enrollments from `student_enrollment` with subject details
9. Fetches column labels from `subject_division` and multi-column info from `division_config`

#### UI (`+page.svelte`)

- User info + logout button
- Subject cards with expandable descriptions
- Voting buttons per subject type (hidden if already voted)
- Voting window countdown
- Enrolled subjects grid with category labels (e.g. `OSE-1`, `MVOP`)

#### API (`+server.ts`)

- **GET** `?type=OSE&grade=2` — returns accepted subjects for type/grade
- **POST** `{ student_id, preferences }` — saves vote to `preferential_round`

---

### Teacher Dashboard (`/teacher`)

#### Server (`+page.server.ts`)

- Authenticates user, verifies `teacher` role
- Loads submission window (`submission_window` table)
- Loads teacher's subjects
- Fetches enrollment counts + student names per subject from `student_enrollment` + `users`

**Form action `addSubject`:**
- Validates: all fields required, MVOP only for grade 3, no duplicate names per grade
- Inserts subject with `teacher_id`, default `state = 'waitlisted'`

#### UI (`+page.svelte`)

- Submission window status feedback (open/closed/upcoming)
- Subject creation form (only active during submission window): name, description, grade, type
- Subject cards showing: name, description, grade, type, approval state
- Per-subject enrollment count with expandable student name list

---

### Voting Page (`/voting`)

#### Server (`+page.server.ts`)

Minimal — authenticates user, returns `db_id`.

#### UI (`+page.svelte`)

1. Checks if already voted via `/voting/already-voted`
2. Fetches subjects from `/api/dashboard?type=X&grade=Y`
3. Drag-and-drop ranking interface with up/down arrow buttons
4. Submit sends ranked preferences to `/api/dashboard` POST

#### API endpoints

- **`/voting/+server.ts`** — GET (subjects) + POST (preferences) — mirrors `/api/dashboard`
- **`/voting/already-voted/+server.ts`** — GET: checks if student has existing votes for a type/grade

---

### API Dashboard (`/api/dashboard`)

Central voting API:

- **GET** `?type=OSE&grade=2` — returns accepted subjects for type/grade
- **POST** `{ student_id, preferences }` — saves preferences with duplicate prevention (checks `preferential_round` for existing votes in same category)

---

### Admin Dashboard (`/admin`)

Central hub for all administrative operations.

#### Server (`+page.server.ts`)

- Authenticates user, verifies `admin` role
- Counts waitlisted subjects for notification badge

#### UI (`+page.svelte`)

**Navigation cards** linking to:
| Card | Route | Description |
|------|-------|-------------|
| Správa předmětů | `/admin/subjects` | Approve/reject teacher subjects |
| Nahrát uživatele | `/admin/upload-users` | Bulk import users from Excel/CSV |
| Správa uživatelů | `/admin/manage-users` | Edit/delete existing users |
| Časové okno pro odesílání | `/admin/submission-window` | Set teacher submission deadline |
| Časové okno pro hlasování | `/admin/voting-window` | Set voting windows per grade |
| Rozdělení předmětů | `/admin/division` | View division results |
| Zařazení studentů | _(inline)_ | Run enrollment + download Excel |

**Inline operations:**
- **Spustit rozdělení** — POST `/admin/division` → runs sorting algorithm, displays ranking + column tables
- **Zařadit studenty** — POST `/admin/enrollment` → runs enrollment algorithm, shows results table
- **Stáhnout Excel** — link to `/admin/enrollment/export` → downloads `.xlsx` file
- **Editovat rozřazení** — links to `/admin/division-table?category=X` for multi-column categories

---

### Admin: Subject Management (`/admin/subjects`)

#### Server (`+page.server.ts`)

- Fetches all subjects (sorted by state + creation date)
- Batch-fetches teacher emails for display

#### UI (`+page.svelte`)

- Filter tabs: All / Waitlisted / Accepted / Rejected
- Subject cards with: name, type, grade, teacher email, state badge, description
- Action buttons to change state (accept/reject/revert)

#### API (`+server.ts`)

- **POST** `{ subject_id, state }` — updates subject state. Required admin role.

---

### Admin: Submission Window (`/admin/submission-window`)

#### Server (`+page.server.ts`)

Loads latest submission window record.

#### UI (`+page.svelte`)

- Datetime inputs for start/end with "Teď" (Now) quick-set buttons
- Active/closed status indicator
- Validation: end must be after start

#### API (`+server.ts`)

- **POST** `{ start, end }` — upserts submission window record

---

### Admin: Voting Window (`/admin/voting-window`)

#### Server (`+page.server.ts`)

Loads voting windows for all grade levels.

#### UI (`+page.svelte`)

- Separate card for each grade (2, 3, 4)
- Per-grade status badges (Open / Closed / Not Set)
- Datetime inputs with "Teď" buttons
- Individual save per grade

#### API (`+server.ts`)

- **POST** `{ target_year, start, end }` — upserts voting window for specific grade

---

### Admin: Division (`/admin/division`)

#### Server (`+page.server.ts`)

Initial SSR: runs `studentSort()` with accepted subjects, returns results.

#### UI (`+page.svelte`)

Read-only view of ranking and column distribution tables.

#### API (`+server.ts`)

- **POST** — runs `studentSort()`, clears `subject_division`, inserts new assignments
- **GET** — loads saved division + recomputes ranking from votes
- **PATCH** `{ subject_id, new_column_label }` — moves subject to different column

---

### Admin: Division Table Editor (`/admin/division-table`)

#### UI (`+page.svelte`)

Drag-and-drop editor for multi-column categories. URL param `?category=OSE_3`.

- Displays columns side-by-side
- Drag subjects between columns
- Save sends batch PATCH requests to `/admin/division`

---

### Admin: Enrollment (`/admin/enrollment`)

#### API (`+server.ts`)

- **POST** — runs `enrollStudents()`, clears and re-inserts `student_enrollment` records
- **GET** — loads saved enrollments with name/category lookups

#### Export (`/admin/enrollment/export/+server.ts`)

- **GET** — generates Excel file with one sheet per category (e.g. `OSE-2.ročník`, `OSE1-3.ročník`)
- Each sheet contains subjects as headers with listed students underneath

---

### Admin: User Management (`/admin/manage-users`)

#### Server (`+page.server.ts`)

Basic auth check.

#### UI (`+page.svelte`)

- Loads users via GET `/admin/upload-users?load=true`
- Inline-editable table (email, name, roles, class, graduation year)
- Bulk select + delete
- Save edits via PATCH `/admin/upload-users`

---

### Admin: Upload Users (`/admin/upload-users`)

#### UI (`+page.svelte`)

- File upload (`.csv`, `.xlsx`, `.xls`)
- Format help with required columns: email, first_name, last_name, role

#### API (`+server.ts`)

- **POST** — parses uploaded file, validates rows, creates users in `users` table + assigns roles via `user_roles`. Auto-creates Supabase Auth accounts
- **GET** `?load=true` — returns all users with their roles for the management page
- **PATCH** — updates user fields and roles
- **DELETE** — removes selected users and their auth accounts

---

### Debug (`/_debug/users`)

Dev-only endpoint (returns 404 in production). Queries `users` table for debugging email matching issues.

---

## Environment Variables

| Variable | Scope | Description |
|----------|-------|-------------|
| `PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anonymous/public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Private | Supabase service role key (admin access) |

---

## Key Data Flows

### 1. Subject Submission (Teacher)
```
Teacher logs in → Checks submission window → Fills form
→ POST addSubject action → Subject saved with state='waitlisted'
→ Admin approves → state='accepted'
```

### 2. Student Voting
```
Student logs in → Dashboard shows accepted subjects
→ Clicks "Zvolit [type]" → Voting page loads subjects from /api/dashboard
→ Check already-voted → Rank subjects via drag-and-drop
→ POST /api/dashboard → Preferences saved to preferential_round
```

### 3. Division & Enrollment (Admin)
```
Admin clicks "Spustit rozdělení"
→ POST /admin/division → studentSort() algorithm runs
→ Subjects assigned to columns → Saved to subject_division

Admin clicks "Zařadit studenty"
→ POST /admin/enrollment → enrollStudents() algorithm runs
→ Students matched to subjects → Saved to student_enrollment

Admin clicks "Stáhnout Excel"
→ GET /admin/enrollment/export → XLSX file generated and downloaded
```

### 4. Authentication
```
Enter email → POST sendOtp → OTP sent via Supabase Auth
→ Enter 6-digit code → POST verifyOtp → Session created
→ Check roles → Redirect to dashboard (/student, /teacher, /admin)
→ Multiple roles → /auth/select-role → Pick role → Redirect
```
