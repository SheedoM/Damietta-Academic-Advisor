# Research: Student Profile Feature

**Branch**: `001-student-profile` | **Date**: 2026-02-24 | **Updated**: 2026-03-03

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

## Decision 3: Academic Level Inference (UPDATED 2026-03-03)

**Decision**: Derived from total passed credit hours (excluding failed courses) using updated bylaw thresholds.

| Level | Credit Hours |
|-------|-------------|
| 1 (Freshman) | 0–29 |
| 2 (Sophomore) | 30–65 |
| 3 (Junior) | 66–101 |
| 4 (Senior) | 102+ |

**Rationale**: Updated from previous thresholds (30/60/90) to match the official university bylaws. The 140 total credit hours over 4 years distribute as: ~30h (L1), ~36h (L2), ~36h (L3), ~38h (L4).

## Decision 4: Recommendation Algorithm Redesign (NEW 2026-03-03)

**Decision**: Replace the existing bucket-first algorithm in `roadmapLogic.ts` with a 4-phase weighted scoring engine.

**Current state**: The existing `generateRoadmap()` function in `roadmapLogic.ts` (333 lines) uses a bucket-priority approach with level-first sorting within each bucket. It already handles prerequisites, term filtering, and elective truncation.

**New approach**: 4-phase algorithm:

1. **Phase 1 — Academic Status Evaluation**: Calculate total earned credits, determine level, calculate CGPA, determine max credit load (12 for CGPA<2.0, 19 otherwise).

2. **Phase 2 — Course Filtering**: Restrict by specialization (general program for levels 1-2, specialization at level 3+), enforce prerequisite checking, truncate elective pools when category requirements met.

3. **Phase 3 — Weight Scoring Engine**: Assign weights to valid courses and sort descending:
   - Failed/Missed courses (lower levels): weight = 100
   - Bottleneck prerequisites (courses with many dependents): weight = 50
   - Current-level mandatory courses: weight = 25
   - Elective courses: weight = 10

4. **Phase 4 — Schedule Generation**: Select from priority queue until max load reached. Check graduation alignment (140h, CPGA≥2.0). Enforce summer training constraint (70+ hours blocks summer registration).

**Rationale**: The current algorithm works well for new students but doesn't explicitly prioritize failed courses or bottleneck prerequisites. The weighted scoring approach provides deterministic priority ordering that handles irregular academic paths.

**Integration approach**: Replace the body of `generateRoadmap()` while keeping the same function signature and return type. The existing `Student` interface and `Course` type remain unchanged. The `BucketStatus` return object is preserved for UI display.

## Decision 5: Failed Course Grade Cap (NEW 2026-03-03)

**Decision**: When a student repeats a failed course and passes, the maximum grade recorded is capped at B (grade points = 3.0, 83%).

**Implementation**: Add an `isRepeated` flag to `PassedCourseRecord`. When computing GPA, if `isRepeated === true` and `gradePoints > 3.0`, cap at 3.0.

## Decision 6: Summer Training Constraint (NEW 2026-03-03)

**Decision**: Students with 70+ credit hours who have not completed summer training are blocked from registering for summer semester courses.

**Implementation**: In Phase 4 of the algorithm, if `student.passedHours >= 70` and `currentTerm === 3` (summer) and summer training is not passed, block all summer course recommendations and display a notice.

## Decision 7: University ID Format (UPDATED 2026-03-03)

**Decision**: `YYYYNNNN` format with no hyphen (e.g., `20260001`). System generates automatically on profile creation; admin can also enter one manually.

**Generation logic**: Extract the current year, scan existing profiles for the highest sequence number in that year, increment by 1 with zero-padding to 4 digits.

**Rationale**: Simple, human-readable format. Updated from `YYYY-NNNN` per user clarification to remove the hyphen.

## Decision 8: Student Authentication

**Decision**: University ID + National ID pair verification. No passwords needed.

**Flow**: Student enters their University ID in the portal, then provides their National ID for verification. The system checks both match a stored profile before granting access.

## Decision 9: Plan Generation Trigger (NEW 2026-03-03)

**Decision**: Lazy generation — plans are auto-generated when the student logs in to the portal. Admins can also manually generate a plan from the student profile view.

**Blocked students**: Blocked students cannot see their semester plan. They can only view their profile and request history.

## Decision 10: UI Redesign Approach (NEW 2026-03-03)

**Decision**: Full UI overhaul to match faculty branding: primary color `#0160C9`, faculty logo (`cai-logo.png`), modern professional design, social media footer.

**Implementation approach**:
- Replace all existing indigo/purple colors with `#0160C9` and its variants
- Add the `cai-logo.png` from `/resources/` to the header
- Add a footer component with social media links
- Use modern design patterns: glassmorphism cards, smooth transitions, gradient backgrounds
- Maintain responsive layout with TailwindCSS

**Color palette derived from #0160C9**:
- Primary: `#0160C9` (faculty blue)
- Primary light: `#3B82F6` (hover/active)
- Primary dark: `#014A9A` (dark variant)
- Accent: `#E0EDFF` (light backgrounds)
