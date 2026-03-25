# 🎓 Subject Enrollment System

A full-stack web application that automates elective subject enrollment at a secondary school — from teacher submissions and student voting to algorithmic distribution and Excel export. Built to replace a manual paper-based process for **200+ students** across **50+ subjects**.

[System Workflow (screenshots)](demo.md)

---

## ✨ Key Features

### 🔐 Authentication & Roles

- **Passwordless OTP login** via email (Supabase Auth)
- **Role-based access control** — students, teachers, and admins each see a different dashboard
- Multi-role support (e.g. a user can be both teacher and admin)

### 👨‍🏫 Teacher Portal

- Submit elective subjects during a configurable time window
- See approval status (waitlisted → accepted / rejected)
- View enrolled students per subject with names

### 🗳️ Student Voting

- **Drag-and-drop preference ranking** — students order subjects from most to least preferred
- Voting windows configurable per grade (2nd, 3rd, 4th year)
- Duplicate vote prevention
- Students see their final enrollment results with category labels

### ⚙️ Admin Dashboard

- **Subject approval** — review, accept, or reject teacher-submitted subjects
- **Time window management** — configure submission and voting periods
- **Algorithm execution** — one-click subject division + student enrollment
- **Drag-and-drop column editor** — manually adjust subject distribution across columns
- **Excel export** — download enrollment results as `.xlsx` (one sheet per category)
- **User management** — bulk import from CSV/Excel, inline editing, role assignment

### 🧮 Sorting & Enrollment Algorithm

- **Preferential voting** — each vote position earns weighted points (1st choice = max points)
- **Snake draft distribution** — subjects split fairly across columns (A→B→C→C→B→A)
- **Automatic enrollment** — students matched to their highest-preferred subject per column
- Handles multiple categories: `OSE` (2nd–4th year) and `MVOP` (3rd year only)

---

## 🏗️ Tech Stack

[SvelteKit](https://kit.svelte.dev/) (Svelte 5 runes) · TypeScript · [Supabase](https://supabase.com/) PostgreSQL · [Tailwind CSS](https://tailwindcss.com/) 4 · Vite · [SheetJS](https://sheetjs.com/)

---

## 🔄 System Workflow

See the full [visual walkthrough with screenshots](demo.md).

```
Admin configures windows → Teachers submit subjects → Admin approves
  → Students rank preferences (drag-and-drop) → Admin runs sorting
  → Admin runs enrollment → Results on dashboards → Export to Excel
```

---

## 📁 Project Structure

```
src/
├── lib/
│   ├── subject-sorting.ts    # Core algorithm (ranking + enrollment)
│   └── supabase-service.server.ts
├── routes/
│   ├── admin/                # 8 sub-routes for management
│   │   ├── subjects/         # Subject approval
│   │   ├── submission-window/ # Teacher deadline config
│   │   ├── voting-window/    # Student voting config (per grade)
│   │   ├── division/         # Subject sorting algorithm
│   │   ├── division-table/   # Drag-and-drop column editor
│   │   ├── enrollment/       # Student enrollment + Excel export
│   │   ├── manage-users/     # User editor
│   │   └── upload-users/     # Bulk CSV/Excel import
│   ├── auth/                 # OTP login, logout, role selection
│   ├── student/              # Student dashboard + voting API
│   ├── teacher/              # Teacher dashboard + subject form
│   └── voting/               # Preference ranking UI
└── hooks.server.ts           # Auth middleware
```

---

## 🗃️ Database

11 PostgreSQL tables with custom enum types. See [database-docs.md](database-docs.md) for full schema.

**Core tables:** `users`, `roles`, `user_roles`, `subjects`, `preferential_round`, `subject_division`, `student_enrollment`, `division_config`

**Key relationships:**

```
users ──< user_roles >── roles
users ──< subjects
users ──< preferential_round >── subjects
users ──< student_enrollment >── subjects
subjects ── subject_division
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)
- [Supabase](https://supabase.com/) project (or local instance)

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd vyber-predmetu

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Fill in your Supabase credentials:
#   PUBLIC_SUPABASE_URL=
#   PUBLIC_SUPABASE_ANON_KEY=
#   SUPABASE_SERVICE_ROLE_KEY=

# Start development server
pnpm dev
```

---

## 📖 Documentation

| Document                             | Description                                                        |
| ------------------------------------ | ------------------------------------------------------------------ |
| [database-docs.md](database-docs.md) | Full database schema, enum types, table relationships              |
| [code-docs.md](code-docs.md)         | Detailed code documentation — every route, API endpoint, algorithm |

---

## 📸 Screenshots

|                                                          |                                                         |
| -------------------------------------------------------- | ------------------------------------------------------- |
| ![Admin Dashboard](screenshots/admin-dashboard.png)      | ![Student Voting](screenshots/student-voting.png)       |
| Admin Dashboard                                          | Drag-and-drop voting                                    |
| ![Subject Approval](screenshots/subject-approval.png)    | ![Student Dashboard](screenshots/student-dashboard.png) |
| Subject approval                                         | Student dashboard                                       |
| ![Sorting Results](screenshots/sorting-results.png)      | ![Excel Export](screenshots/excel-export.png)           |
| Sorting algorithm results                                | Excel export                                            |
| **[Subject Approval](screenshots/subject-approval.png)** | Filter by state, approve/reject with one click          |
| **Division Results**                                     | Popularity ranking + column distribution tables         |
| **[Excel Export](screenshots/excel-result.png)**         | Downloaded spreadsheet with per-category sheets         |
