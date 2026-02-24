# Research: Student Profile Feature

**Branch**: `001-student-profile` | **Date**: 2026-02-24

## Decision 1: Storage Pattern

**Decision**: Use localStorage with a dedicated key `student_profiles`, following the pattern established in `request.ts` and `CourseContext.tsx`.

**Rationale**: The entire application is client-side only. Both existing data systems (course management and student requests) use localStorage with JSON serialization. Adding a third follows the established architecture without introducing new dependencies.

**Alternatives considered**:
- IndexedDB: More powerful but unnecessarily complex for a small dataset. The current app successfully stores course data and requests in localStorage.
- In-memory only: Would lose data on refresh, conflicting with SC-002 (100% persistence).

## Decision 2: GPA Calculation Method

**Decision**: Weighted average using the Egyptian university grading scale.

**Formula**: `GPA = sum(gradePoints × creditHours) / sum(creditHours)`

**Grade Point Mapping**:
| Grade | Points | Range |
|-------|--------|-------|
| Excellent | 4.0 | 3.6–4.0 |
| Very Good | 3.0 | 2.8–3.59 |
| Good | 2.0 | 2.0–2.79 |
| Pass | 1.0 | 1.0–1.99 |
| Fail | 0.0 | 0 |

**Rationale**: Standard scale used at Egyptian public universities including Damietta University. Grade points are stored per course record so GPA can be recalculated when courses are added/removed.

**Key decision**: Failed courses count in GPA calculation (lowering it) but their credit hours do NOT count toward total passed hours or academic level.

## Decision 3: Academic Level Inference

**Decision**: Derived from total passed credit hours (excluding failed courses).

| Level | Credit Hours |
|-------|-------------|
| 1 | 0–29 |
| 2 | 30–59 |
| 3 | 60–89 |
| 4 | 90+ |

**Rationale**: Matches the existing `CourseLevel` type (1–4) in the codebase. Thresholds follow typical Egyptian university bylaws for a 4-year program (~144 total credit hours, ~36 per year).

## Decision 4: Student–Roadmap Integration

**Decision**: Convert `StudentProfile` to the existing `Student` type when generating roadmaps. No changes to `roadmapLogic.ts`.

**Rationale**: The existing `generateRoadmap()` function accepts a `Student` object with `{ major, gpa, passedCourses, passedHours }`. We create a conversion function `toStudentForRoadmap()` that maps stored profile data to this shape, keeping the roadmap engine completely untouched.

## Decision 5: State Management

**Decision**: New `StudentContext` following the same Provider pattern as `CourseContext`.

**Rationale**: Consistent with the existing architecture. The context provides reactive state updates when students are added/modified/deleted, and components can access student data via `useStudents()` hook.

## Decision 6: University ID Generation

**Decision**: Year-sequence format `YYYY-NNNN` (e.g., `2026-0001`). System generates automatically on profile creation; admin can also enter one manually.

**Generation logic**: Extract the current year, scan existing profiles for the highest sequence number in that year, increment by 1 with zero-padding to 4 digits.

**Rationale**: Simple, human-readable format that provides uniqueness without requiring external services. The year prefix groups students by enrollment year. Admin override allows importing students with existing IDs.

**Alternatives considered**:
- UUID: Too long and meaningless for students to remember/type.
- Program-year-sequence (e.g., `CS-2026-0001`): Rejected because a student may change majors, making the prefix misleading.

## Decision 7: Student Authentication

**Decision**: University ID + National ID pair verification. No passwords needed.

**Flow**: Student enters their University ID in the portal, then provides their National ID for verification. The system checks both match a stored profile before granting access.

**Rationale**: Simplest approach for a client-side system with no backend. National ID serves as a "something you know" factor. No password management, reset flows, or hashing needed.

**Alternatives considered**:
- University ID + password: More complex, requires password storage, change flows, and potentially hashing. Overkill for a client-side demo app.
- University ID only: Too insecure — sequential IDs are easily guessable.

## Decision 8: Request–Student Linkage

**Decision**: Use the existing `studentId` field in `StudentRequest` as the University ID linkage. Add a `getRequestsByStudentId()` function to query all requests for a given student.

**Rationale**: The `studentId` field already exists in `StudentRequest` and is populated when students submit requests in the portal. By matching this to `StudentProfile.universityId`, we get request history without changing the existing request schema.

## Decision 9: Student Portal Enhancement vs. Separate Dashboard

**Decision**: Enhance the existing `StudentPortal.tsx` with an authentication gate and dashboard view. No separate student dashboard page.

**Rationale**: The user explicitly stated no separate dashboard is needed. The existing portal already has the request submission flow; adding an auth gate + history view keeps everything in one place and avoids router/navigation changes.

## Decision 10: Blocked Student Behavior

**Decision**: Read-only access. Blocked students can authenticate and view their profile and request history, but see a "Blocked" banner and cannot submit new requests.

**Rationale**: Provides transparency (student knows they're blocked and can still see their academic data) without allowing any new actions. The submit button is disabled with a clear explanation.
