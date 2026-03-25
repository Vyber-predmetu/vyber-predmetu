# Database Documentation

## Overview

The system uses **11 PostgreSQL tables** to manage the subject enrollment process through preferential voting.

## Database diagram

[Database diagram](db-diagram.png)

[Interactive version on dbdiagram.io](https://dbdiagram.io/d/Supabase-69171e646735e11170d5fd0b)

---

## Custom Types (Enums)

| Type | Values |
|------|--------|
| `target_year_type` | `2`, `3`, `4` |
| `subject_type` | `'OSE'`, `'MVOP'` |
| `state_type` | `'waitlisted'`, `'accepted'`, `'rejected'` |
| `status_type` | `'active'`, `'waitlist'`, `'dropped'` |
| `class_letter_type` | `'A'`, `'B'`, `'C'`, `'K'`, `'Ga'`, `'Gb'` |
| `role_type` | `'student'`, `'teacher'`, `'admin'` |

---

## Tables

### 1. Users & Authentication

#### `users`
Stores all user accounts (students, teachers, admins).

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `email` | text | User email (unique) |
| `first_name` | text | First name |
| `last_name` | text | Last name |
| `class_letter` | class_letter_type | Class section (A, B, C, K, Ga, Gb) — applicable to students |
| `graduation_year` | int4 | Year of graduation — applicable to students |
| `created_at` | timestamptz | Account creation timestamp |

**Note:**
`Ga` also represents the current G class.

**Constraints:**
- `UNIQUE(email)`

**Referenced by:**
- `user_roles.user_id` → `users.id` (1:N)
- `subjects.teacher_id` → `users.id` (1:N)
- `preferential_round.student_id` → `users.id` (1:N)
- `student_enrollment.student_id` → `users.id` (1:N)

---

#### `roles`
Defines available roles in the system.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `role_name` | role_type | Role name: `'student'`, `'teacher'`, or `'admin'` |

**Referenced by:**
- `user_roles.role_id` → `roles.id` (1:N)

---

#### `user_roles`
Junction table linking users to their roles. A user can have multiple roles.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | Foreign key → `users.id` |
| `role_id` | uuid | Foreign key → `roles.id` |

**Foreign Keys:**
- `user_id` → `users.id` (N:1)
- `role_id` → `roles.id` (N:1)

---

### 2. Subjects & Submission

#### `subjects`
Available elective subjects offered by teachers.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `teacher_id` | uuid | Foreign key → `users.id` |
| `subject_type` | subject_type | Subject type: `'OSE'` or `'MVOP'` |
| `target_grade` | target_year_type | Grade for which the subject will be for next year: `2`, `3`, or `4` |
| `name` | text | Subject name |
| `description` | text | Subject description |
| `state` | state_type | Approval state: `'waitlisted'`, `'accepted'`, or `'rejected'` |
| `created_at` | timestamptz | Creation timestamp |

**Constraints:**
- `UNIQUE(name)`

**Foreign Keys:**
- `teacher_id` → `users.id` (N:1) — many subjects belong to one teacher

**Referenced by:**
- `preferential_round.subject_id` → `subjects.id` (1:N)
- `student_enrollment.subject_id` → `subjects.id` (1:N)
- `subject_division.subject_id` → `subjects.id` (1:1)

---

#### `submission_window`
Defines the time window when teachers can submit subjects.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `start` | timestamptz | Start of submission period |
| `end` | timestamptz | End of submission period |
| `created_at` | timestamptz | Configuration creation time |

---

### 3. Voting System

#### `voting_window`
Controls when students can submit their preferences, split by target year.

| Column | Type | Description |
|--------|------|-------------|
| `target_year` | target_year_type | Target grade (2, 3, 4) |
| `start` | timestamptz | Start of voting period |
| `end` | timestamptz | End of voting period |
| `created_at` | timestamptz | Configuration creation time |

**Note:**
The voting is split by grades to prevent system overload and allow separate scheduling.

---

#### `preferential_round`
Stores student preferences for the assignment algorithm.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `student_id` | uuid | Foreign key → `users.id` |
| `subject_id` | uuid | Foreign key → `subjects.id` |
| `subject_order` | int8 | Preference rank (1 = first choice, 2 = second...) |
| `round_number` | int2 | Enrollment round number |
| `created_at` | timestamptz | Vote timestamp |

**Constraints:**
- `UNIQUE(student_id, subject_id)` — student can't vote for same subject twice
- `UNIQUE(student_id, subject_order)` — student can't rank two subjects with same order

**Example:**
```
student_id=abc, subject_id=def, subject_order=1  → First choice
student_id=abc, subject_id=ghi, subject_order=2  → Second choice
student_id=abc, subject_id=jkl, subject_order=3  → Third choice
```

---

### 4. Configuration

#### `subject_capacity_config`
Global capacity settings for all subjects.

| Column | Type | Description |
|--------|------|-------------|
| `id` | int4 | Primary key (always = 1) |
| `max_capacity` | int4 | Maximum students per subject (default: 17) |
| `updated_at` | timestamptz | Last update timestamp |

**Constraints:**
- `CHECK(id = 1)` — only one row allowed, because there can be only one capacity.

**Purpose:** Not hardcoding a subject capacity that might change later in the future.

---

#### `division_config`
Defines how many columns exist for each grade/type combination.

| Column | Type | Description |
|--------|------|-------------|
| `id` | int8 | Primary key |
| `target_year` | target_year_type | Grade level (2, 3, 4) |
| `subject_type` | subject_type | Subject type: `'OSE'` or `'MVOP'` |
| `column_label` | text | Column identifier (A, B, C...) |
| `created_at` | timestamptz | Configuration creation time |

**Constraints:**
- `UNIQUE(target_year, subject_type, column_label)`

**Example data:**
```
Grade 2: 1 OSE column (A) → Students choose 1 OSE
Grade 3: 2 OSE columns (A, B) + 1 MVOP column (A) → Students choose 2 OSE + 1 MVOP
Grade 4: 3 OSE columns (A, B, C) → Students choose 3 OSE
```

---

### 5. Results

#### `subject_division`
Result of the sorting algorithm — subjects are divided into columns based on popularity.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `subject_id` | uuid | Foreign key → `subjects.id` |
| `column_label` | text | Assigned column (A, B, C...) |
| `created_at` | timestamptz | Assignment timestamp |

**Constraints:**
- `UNIQUE(subject_id)`

**Foreign Keys:**
- `subject_id` → `subjects.id` (1:1) — one subject assigned to one column

---

#### `student_enrollment`
The final enrollment results. Shows which students are enrolled in which subjects and their status.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `student_id` | uuid | Foreign key → `users.id` |
| `subject_id` | uuid | Foreign key → `subjects.id` |
| `target_year` | target_year_type | `2`, `3`, `4` |
| `subject_type` | subject_type | Subject type: `'OSE'` or `'MVOP'` |
| `status` | status_type | Enrollment status |
| `created_at` | timestamptz | Enrollment timestamp |

**Status values:**
- `'active'` — successfully enrolled
- `'waitlist'` — waiting for an entrance exam done by a teacher
- `'dropped'` — student did not pass the entrance exam

**Constraints:**
- `UNIQUE(student_id, subject_id)`

---

## System Workflow

### 1. Configuration Phase
Admin sets up the system:
- Open submission window in `submission_window`
- Configure division columns in `division_config`
- Set subject capacity in `subject_capacity_config`

### 2. Subject Submission
Teachers submit subjects during the submission window:
- Create subjects with description, type (OSE/MVOP), and target grade
- Subjects stored in `subjects` table with `state = 'waitlisted'`
- Admin reviews and approves (`state = 'accepted'`) or rejects (`state = 'rejected'`) subjects

### 3. Voting Phase
Admin opens voting window in `voting_window` (per grade):
- Students rank **accepted** subjects by preference (1st, 2nd, 3rd choice… up to subject count)
- Votes stored in `preferential_round` table

### 4. Algorithm Execution
After the voting window ends, admin runs the assignment algorithm:
- Algorithm distributes popular subjects into columns → `subject_division`
- Algorithm assigns students to subjects based on preferences → `student_enrollment`

### 5. Entrance Exams (Optional)
- Students assigned to subjects **with available capacity** get `status = 'active'`
- Students assigned to subjects **over capacity** get `status = 'waitlist'` and must take an entrance exam
- Teachers update status after the entrance exam:
  - Pass: `status = 'active'`
  - Fail: `status = 'dropped'`

### 6. Results
Students see their assigned subjects and enrollment status.

---

## Key Relationships
```
users (1) ────< (N) user_roles >──── (1) roles
users (1) ────< (N) subjects
users (1) ────< (N) preferential_round
users (1) ────< (N) student_enrollment

subjects (1) ────< (N) preferential_round
subjects (1) ────< (N) student_enrollment
subjects (1) ──── (1) subject_division
```
