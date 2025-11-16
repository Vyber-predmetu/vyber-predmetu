# Database Documentation

## Overview

The system uses **10 PostgreSQL tables** to manage the subject enrollment process through preferential voting.

## Database diagram

[Database diagram](db-diagram.png)

[Interactive version on dbdiagram.io](https://dbdiagram.io/d/Supabase-69171e646735e11170d5fd0b)

---

## Tables

### 1. Users & Authentication

#### `student_users`
Stores student account information.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key |
| `e_mail` | text | Student email (unique) |
| `first_name` | text | Student's first name |
| `last_name` | text | Student's last name |
| `class_letter` | enum | Class section (A, B, C, K, Ga, Gb) |
| `graduation_year` | integer | Year of graduation |
| `crated_at` | timestamptz | Account creation timestamp |

**Note:**
`Ga` also represents the current G class.

**Constraints:**
- `UNIQUE(e_mail)`

**Referenced by:**
- `preferential_round.student_id` → `student_users.id` (1:N)
  - One student can have many preference votes
- `student_enrollment.student_id` → `student_users.id` (1:N)
  - One student can have many enrollments

---

#### `teachers_admin_users`
Stores teacher and admin account information.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key |
| `e_mail` | text | Email (unique) |
| `role` | enum | User role: `'teacher'` or `'admin'` |
| `first_name` | text | First name |
| `last_name` | text | Last name |
| `crated_at` | timestamptz |Creation timestamp |

**Constraints:**
- `UNIQUE(e_mail)`
- `DEFAULT(role) = 'teacher'`

**Referenced by:**
- `subjects.teacher_id` → `teachers_admin_users.id` (1:N)
  - One teacher can teach many subjects
---


User tables are split into two for better row level security for different users.


---
### 2. Subjects & Submission

#### `subjects`
Available elective subjects offered by teachers.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key |
| `teacher_id` | bigint | Foreign key |
| `type_of_subject` | enum | Subject type: `'OSE'` or `'MVOP'` |
| `target_grade` | enum | Grade for which the subject will be for next year: `2`, `3`, or `4` |
| `name` | text | Subject name (unique) |
| `description` | text | Subject description |
| `created_at` | timestamptz | Creation timestamp |

**Constraints:**
- `UNIQUE(name)`

**Foreign Keys:**
- `teacher_id` → `teachers_admin_users.id` (N:1)
  - Many subjects belong to one teacher

**Referenced by:**
- `preferential_round.subject_id` → `subjects.id` (1:N)
  - One subject can receive many votes
- `student_enrollment.subject_id` → `subjects.id` (1:N)
  - One subject can have many student enrollments
- `subject_division.subject_id` → `subjects.id` (1:1)
  - One subject is assigned to one column

---

#### `submission_window`
Defines the time window when teachers can submit subjects.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key |
| `submissions_start` | timestamptz | Start of submission period |
| `submissions_end` | timestamptz | End of submission period |
| `created_at` | timestamptz | Configuration creation time |

---

### 3. Voting System

#### `voting_window`
Controls when students can submit their preferences.(Support for multiple enrollment rounds.)

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key |
| `target_year` | enum | Target grade (2, 3, 4) |
| `voting_start` | timestamptz | Start of voting period |
| `voting_end` | timestamptz | End of voting period |
| `round_number` | smallint | Enrollment round number (for now only 1) |
| `created_at` | timestamptz | Configuration creation time |

**Note:**
The voting is split by grades to prevent system overload.

---

#### `preferential_round`
Stores student preferences for the assignment algorithm.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key |
| `student_id` | bigint | Foreign key |
| `subject_id` | bigint | Foreign key |
| `subject_order` | integer | Preference rank (1 = first choice, 2 = second...) |
| `created_at` | timestamptz | Vote timestamp |

**Constraints:**
- `UNIQUE(student_id, subject_id)` - Student can't vote for same subject twice
- `UNIQUE(student_id, subject_order)` - Student can't rank two subjects with same order

**Example:**
```
student_id=123, subject_id=45, subject_order=1  → First choice
student_id=123, subject_id=67, subject_order=2  → Second choice
student_id=123, subject_id=89, subject_order=3  → Third choice
...
```

---

### 4. Configuration

#### `subject_capacity_config`
Global capacity settings for all subjects.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Primary key (always = 1) |
| `max_capacity` | integer | Maximum students per subject (default: 17) |
| `updated_at` | timestamptz | Last update timestamp |

**Constraints:**
- `CHECK(id = 1)` - Only one row allowed, because there can be only one capacity.

**Purpose:** Not hardcoding a subject capacity that might change later in the future.

---

#### `division_config`
Defines how many subjects each grade must choose and which columns exist for distribution.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key |
| `target_year` | enum | Grade level (2, 3, 4) |
| `subject_type` | enum | Subject type: `'OSE'` or `'MVOP'` |
| `column_label` | text | Column identifier (A, B, C...) |
| `created_at` | timestamptz | Configuration creation time |

**Constraints:**
- `UNIQUE(target_year, subject_type, column_label)`

**Referenced by:**
- `subject_division.(target_year, subject_type, column_label)` → `division_config.(target_year, subject_type, column_label)` (N:1)
  - Ensures subject assignments only use valid column configurations

**Example data:**
```
Grade 2: 1 OSE column (A) → Students choose 1 OSE
Grade 3: 2 OSE columns (A, B) + 1 MVOP column (A) → Students choose 2 OSE + 1 MVOP
Grade 4: 3 OSE columns (A, B, C) → Students choose 3 OSE
```

---

### 5. Results

#### `subject_division`
Result of the algorithm - subjects are chosen based on popularity and divided into X collumns equally.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key (auto-increment) |
| `target_year` | enum | Grade level |
| `subject_id` | bigint | Foreign key |
| `subject_type` | enum | Subject type: `'OSE'` or `'MVOP'` |
| `column_label` | text | Assigned column (A, B, C...) |
| `created_at` | timestamptz | Assignment timestamp |

**Constraints:**
- `UNIQUE(subject_id)`

**Foreign Keys:**
- `subject_id` → `subjects.id` (1:1)
  - One subject assigned to one column
- `(target_year, subject_type, column_label)` → `division_config.(target_year, subject_type, column_label)` (N:1)
  - Ensures only valid column configurations are used
  - Example: Cannot assign grade 2 to column C (only column A exists for grade 2)

---

#### `student_enrollment`
The final enrollment results. Shows which students are enrolled in which subjects and their status.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key |
| `student_id` | bigint | Foreign key |
| `subject_id` | bigint | Foreign key |
| `target_year` | enum | `2, 3, 4` |
| `subject_type` | enum | Subject type: `'OSE'` or `'MVOP'` |
| `status` | enum | Enrollment status |
| `created_at` | timestamptz | Enrollment timestamp |

**Status values:**
- `'active'` - Successfully enrolled
- `'waitlist'` - Students are waiting for an entrance exam done by a teacher of their elected subject
- `'dropped'` - Student did not get in on the entrance exam

**Constraints:**
- `UNIQUE(student_id, subject_id)`

---

## System Workflow

### 1. Configuration Phase
Admin sets up the system:
- Open submission window in `submission_window`

### 2. Subject Submission
Teachers submit subjects:
- Create subjects with description, type (OSE/MVOP), and target grade
- Subjects stored in `subjects` table

### 3. Voting Phase
Admin opens voting window in `voting_window`:
- Students rank subjects by preference (1st, 2nd, 3rd choice... subject lenght)
- Votes stored in `preferential_round` table

### 4. Algorithm Execution
After the voting window ends admin runs the assignment algorithm:
- Algorithm distributes popular subjects into columns → `subject_division`
- Algorithm assigns students to subjects based on preferences → `student_enrollment`

### 5. Entrance Exams (Optional)
Until the voting window is open all students have status waitlisted.
Then:
- Students assigned to subjects **with available capacity** get `status = 'active'` (direct enrollment)
- Students assigned to subjects **over capacity** get `status = 'waitlist'` and must take an entrance exam
- Teachers update status after the entrance exam:
  - Pass: `status = 'active'`
  - Fail: `status = 'dropped'`

### 6. Results
Students see their assigned subjects and enrollment status.

---

## Key Relationships
```
student_users (1) ────< (N) preferential_round
student_users (1) ────< (N) student_enrollment

teachers_admin_users (1) ────< (N) subjects

subjects (1) ────< (N) preferential_round
subjects (1) ────< (N) student_enrollment
subjects (1) ──── (1) subject_division

division_config (1) ────< (N) subject_division
  ↑
  └─── Composite FK: (target_year, subject_type, column_label)
       Validates that only configured columns can be used
```
