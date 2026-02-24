# Implementation Plan: Comprehensive Student Profile

**Branch**: `001-student-profile` | **Date**: 2026-02-24 | **Spec**: [spec.md](file:///F:/Coding%20projects/damietta-university-academic-advisor/specs/001-student-profile/spec.md)
**Input**: Feature specification from `/specs/001-student-profile/spec.md`

## Summary

Enhance the existing academic advisor application with a comprehensive student profile system. This includes: adding University ID generation and blocked status to student profiles, implementing University ID + National ID pair authentication in the existing student portal, linking registration requests to student profiles for historical tracking, enabling admin blocking/unblock functionality, and enhancing the student portal to show academic status and request history for authenticated students.

## Technical Context

**Language/Version**: TypeScript 5.x + React 18.x  
**Primary Dependencies**: Vite, React, Lucide React (icons), Tailwind CSS  
**Storage**: localStorage (client-side only, no backend)  
**Testing**: No existing test framework; manual browser verification  
**Target Platform**: Web browser (desktop)  
**Project Type**: Single-page web application  
**Constraints**: Client-side only, all data in localStorage  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution is a blank template with no custom principles defined. No gate violations possible.

## Project Structure

### Documentation (this feature)

```text
specs/001-student-profile/
├── plan.md              # This file
├── research.md          # Phase 0 output (updated)
├── data-model.md        # Phase 1 output (updated)
├── quickstart.md        # Phase 1 output (updated)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── types/
│   ├── index.ts          # Core types (Student, Course, Major, Term, etc.)
│   ├── request.ts        # StudentRequest type + CRUD (MODIFY: add getRequestsByStudentId)
│   └── student.ts        # StudentProfile type + CRUD (MODIFY: add universityId, isBlocked, ID generation)
├── lib/
│   ├── gradeUtils.ts     # GPA, level, roadmap conversion utils (existing, minor updates)
│   └── roadmapLogic.ts   # Roadmap engine (NO CHANGES)
├── context/
│   ├── CourseContext.tsx  # Course state provider (NO CHANGES)
│   └── StudentContext.tsx # Student state provider (MODIFY: expose lookup by universityId)
├── components/
│   ├── StudentForm.tsx    # Form for creating/editing students (MODIFY: add universityId, remove courses for non-transfer)
│   ├── StudentProfileView.tsx # Profile viewer (MODIFY: add universityId display, block toggle)
│   └── StudentPlanEditor.tsx  # Plan editor (NO CHANGES)
├── pages/
│   ├── AdminDashboard.tsx # Admin UI (MODIFY: add block/unblock button, show universityId)
│   └── StudentPortal.tsx  # Student UI (MODIFY: add auth gate, request history, academic status view)
├── data/
│   ├── courses.ts         # Course data entry point (NO CHANGES)
│   └── courseDatabase.ts   # Course database (NO CHANGES)
├── App.tsx               # App root (NO CHANGES — already has StudentProvider)
└── main.tsx              # Entry point (NO CHANGES)
```

**Structure Decision**: Single-project React SPA. All changes are within the existing `src/` directory following established patterns.

---

## Proposed Changes

### Component 1: Data Layer — Types & Storage

> Add University ID, blocked status to student profile; add request lookup by student ID.

#### [MODIFY] [student.ts](file:///F:/Coding%20projects/damietta-university-academic-advisor/src/types/student.ts)

- Add `universityId: string` field to `StudentProfile` interface
- Add `isBlocked: boolean` field to `StudentProfile` interface (default: `false`)
- Add `generateUniversityId(): string` function — format `YYYY-NNNN` using current year + sequential counter from existing profiles
- Add `getStudentByUniversityId(universityId: string): StudentProfile | undefined` lookup function
- Update `saveStudent()` to auto-generate `universityId` if not provided
- Update `studentExists()` to also check university ID uniqueness

#### [MODIFY] [request.ts](file:///F:/Coding%20projects/damietta-university-academic-advisor/src/types/request.ts)

- Add `getRequestsByStudentId(studentId: string): StudentRequest[]` function — returns all requests where `studentId` matches, sorted by `createdAt` descending

---

### Component 2: State Management

> Expose new lookup functions through context.

#### [MODIFY] [StudentContext.tsx](file:///F:/Coding%20projects/damietta-university-academic-advisor/src/context/StudentContext.tsx)

- Add `getStudentByUniversityId(universityId: string)` to context value
- Add `toggleBlock(nationalId: string)` to context value — flips `isBlocked`
- Ensure context consumers can access the new functions

---

### Component 3: Admin UI Enhancements

> University ID display, block/unblock toggle, restrict course entry to transfer students.

#### [MODIFY] [StudentForm.tsx](file:///F:/Coding%20projects/damietta-university-academic-advisor/src/components/StudentForm.tsx)

- Add read-only University ID field (auto-generated on create, displayed on edit)
- Allow admin to optionally enter a custom University ID on create
- Hide the passed courses section when Transfer Student toggle is OFF (new students start with zero courses)
- Show passed courses section only when Transfer Student toggle is ON

#### [MODIFY] [StudentProfileView.tsx](file:///F:/Coding%20projects/damietta-university-academic-advisor/src/components/StudentProfileView.tsx)

- Display University ID prominently in profile header
- Add block/unblock toggle button with visual indicator (red badge if blocked)
- Show request history for the student (using `getRequestsByStudentId`)

#### [MODIFY] [AdminDashboard.tsx](file:///F:/Coding%20projects/damietta-university-academic-advisor/src/pages/AdminDashboard.tsx)

- Show University ID column in student list table
- Add blocked status indicator (badge/icon) in student list
- Add block/unblock action button in student list or profile view
- Enable search by University ID in addition to name/national ID

---

### Component 4: Student Portal Enhancement

> The most significant change: add auth gate, request history, and academic status to the existing portal.

#### [MODIFY] [StudentPortal.tsx](file:///F:/Coding%20projects/damietta-university-academic-advisor/src/pages/StudentPortal.tsx)

**New flow (two paths):**

1. **Unauthenticated path** (existing flow): Student enters details → selects courses → generates plan → submits request. The `studentId` field in this flow becomes the University ID.

2. **Authenticated path** (NEW): Student enters University ID + National ID → system verifies the pair → shows:
   - Academic status (GPA, level, passed hours, major)
   - Request history across semesters (all past requests)
   - Option to submit a new registration request (pre-populated with profile data)
   - If blocked: show "Blocked" banner, disable request submission

**Implementation approach:**
- Add a new `ViewMode` option: `'auth'` — shown as an entry point alongside the existing flow
- Add `'dashboard'` view mode — shown after successful authentication
- Add `'history'` view mode — shows all past requests for the authenticated student
- The existing `'input' → 'courses' → 'plan' → 'submit'` flow remains for new/unauthenticated students
- When authenticated, the request submission flow pre-populates student data from the profile

---

## Verification Plan

### Automated Tests

No automated test framework exists in this project. TypeScript compilation serves as the primary automated check:

```bash
npx tsc --noEmit
```

### Manual Browser Verification

Start the dev server and test in browser:

```bash
npm run dev
# Opens at http://localhost:5173
```

**Test Scenarios (in order):**

1. **Admin creates a student** — Navigate to Admin Dashboard → Students tab → Add Student → enter name + national ID + major → verify University ID is auto-generated in `YYYY-NNNN` format → verify student appears in list with University ID column

2. **Admin creates a transfer student** — Add Student → enable Transfer toggle → enter previous university → add passed courses with grades → verify GPA and level compute correctly → verify University ID generated

3. **Non-transfer student has no course section** — Add Student → leave Transfer toggle OFF → verify no passed courses section appears

4. **Admin blocks a student** — Select a student → click block button → verify blocked badge appears in student list and profile view

5. **Student authenticates in portal** — Go to Student Portal → enter University ID + National ID → verify access is granted → verify academic status displays correctly

6. **Student views request history** — After authenticating, verify all past requests for that student are listed chronologically

7. **Blocked student sees read-only view** — Authenticate as a blocked student → verify "Blocked" banner appears → verify submit button is disabled → verify profile and history are still visible

8. **Student submits new request** — Authenticate → submit new registration request → verify it appears in request history and in admin dashboard

9. **Data persists across refresh** — Create student, submit requests, refresh page → verify all data is preserved

## Complexity Tracking

No constitution violations to justify.
