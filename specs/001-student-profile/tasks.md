# Tasks: Student Profile Implementation

**Branch**: `001-student-profile` | **Generated**: 2026-02-24

## Phase 1: Setup & Data Layer

- [x] **T-001**: Create student types and localStorage CRUD (`src/types/student.ts`)
  - Define `Grade`, `PassedCourseRecord`, `StudentProfile` types
  - Implement `saveStudent()`, `getAllStudents()`, `getStudentById()`, `deleteStudent()`
  - localStorage key: `student_profiles`

- [x] **T-002**: Create grade utilities (`src/lib/gradeUtils.ts`) [P]
  - `GRADE_POINTS` map
  - `calculateGPA()`, `inferAcademicLevel()`, `calculatePassedHours()`
  - `toStudentForRoadmap()` converter

## Phase 2: State Management

- [x] **T-003**: Create StudentContext (`src/context/StudentContext.tsx`)
  - Provider with localStorage persistence
  - `useStudents()` hook
  - CRUD operations + national ID uniqueness validation

- [x] **T-004**: Wrap App with StudentProvider (`src/App.tsx`)

## Phase 3: UI Components

- [x] **T-005**: Create StudentForm component (`src/components/StudentForm.tsx`)
  - Name, National ID, Major fields
  - Transfer Student toggle → reveals Previous University + course section
  - Validation + save via context

- [x] **T-006**: CourseGradeSelector integrated into StudentForm directly
  - Searchable course list filtered by major
  - Grade dropdown per course (Egyptian scale)
  - Running GPA display
  - Duplicate prevention

- [x] **T-007**: Create StudentProfileView component (`src/components/StudentProfileView.tsx`)
  - Profile details, computed GPA, academic level, passed hours
  - Passed courses table with grades
  - Progress bar, Generate Roadmap button
  - Edit/Delete actions

## Phase 4: Integration

- [x] **T-008**: Add Students tab to AdminDashboard (`src/pages/AdminDashboard.tsx`)
  - New "Students" tab alongside existing tabs
  - Student list table (Name, National ID, Major, GPA, Level, Transfer)
  - Search by name or national ID
  - Add Student button → StudentForm modal
  - Click row → StudentProfileView

- [x] **T-009**: Enhance AdminDashboard with University ID and blocked status
  - Added University ID column in student list table
  - Added Blocked badge alongside Transfer badge in Status column
  - Search now supports name, national ID, and university ID

## Phase 5: Student Portal Authentication

- [x] **T-010**: Add student auth flow to StudentPortal (`src/pages/StudentPortal.tsx`)
  - Added `login` and `dashboard` ViewMode options
  - "My Account" navigation button (separate from existing flow)
  - Login form: University ID + National ID verification
  - Dashboard: academic status cards (GPA, hours, level, courses)
  - Progress bar to graduation
  - Request history with status badges and admin replies
  - Blocked banner with disabled request submission
  - "Submit New Request" pre-fills student data into existing flow

## Phase 6: Verification

- [x] **T-011**: Build verification
  - TypeScript compilation: `tsc --noEmit` passes with zero errors
  - Dev server: Vite starts successfully on port 5173
  - Browser testing: requires manual verification
