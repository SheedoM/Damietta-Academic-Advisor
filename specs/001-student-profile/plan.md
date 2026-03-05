# Implementation Plan: Student Profile — Algorithm Redesign + UI Overhaul

**Branch**: `001-student-profile` | **Date**: 2026-03-03 | **Spec**: [spec.md](file:///F:/Coding%20projects/damietta-university-academic-advisor/specs/001-student-profile/spec.md)
**Input**: Revised feature specification from `/specs/001-student-profile/spec.md`

## Summary

This revision adds three major workstreams to the existing student profile feature:
1. **Recommendation algorithm redesign** — Replace the bucket-first algorithm with a 4-phase weighted scoring engine (academic status evaluation → course filtering → weight scoring → schedule generation)
2. **UI overhaul** — Rebrand the entire application to match faculty styling (`#0160C9`, `cai-logo.png`, social footer, modern professional design)
3. **Data model updates** — University ID format change to `YYYYNNNN` (no hyphen), updated academic level thresholds (30/66/102), `isRepeated` field for failed course grade cap, lazy plan generation on student login, blocked students can't view plan

## Technical Context

**Language/Version**: TypeScript 5.x + React 18.x  
**Primary Dependencies**: Vite, React, Tailwind CSS  
**Storage**: localStorage (client-side only, no backend)  
**Testing**: No automated test framework; TypeScript compilation + manual browser verification  
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
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (to be regenerated)
```

### Source Code (repository root)

```text
src/
├── types/
│   ├── index.ts          # Core types (Student, Course, BucketPriority, etc.) — NO CHANGES
│   ├── request.ts        # StudentRequest type + CRUD — NO CHANGES
│   └── student.ts        # StudentProfile type + CRUD — MODIFY (YYYYNNNN format, isRepeated)
├── lib/
│   ├── gradeUtils.ts     # GPA, level, roadmap conversion — MODIFY (level thresholds, grade cap)
│   └── roadmapLogic.ts   # Roadmap engine — REWRITE (4-phase weighted scoring)
├── context/
│   ├── CourseContext.tsx  # Course state provider — NO CHANGES
│   └── StudentContext.tsx # Student state provider — NO CHANGES
├── components/
│   ├── StudentForm.tsx    # Student create/edit form — MODIFY (YYYYNNNN display)
│   ├── StudentProfileView.tsx # Profile viewer — MODIFY (academic observation, plan generation)
│   ├── StudentPlanEditor.tsx  # Plan editor — NO CHANGES
│   ├── Header.tsx         # NEW — Shared header with logo
│   └── Footer.tsx         # NEW — Shared footer with social links
├── pages/
│   ├── AdminDashboard.tsx # Admin UI — MODIFY (branding, observation badge)
│   └── StudentPortal.tsx  # Student UI — MODIFY (branding, lazy plan gen, blocked plan hiding)
├── data/
│   ├── courses.ts         # Course data entry point — NO CHANGES
│   └── courseDatabase.ts  # Course database — NO CHANGES
├── App.tsx               # App root — MODIFY (add Header + Footer wrapper)
├── index.css             # Global styles — MODIFY (brand colors, modern design tokens)
├── main.tsx              # Entry point — NO CHANGES
└── vite-env.d.ts         # Vite types — NO CHANGES
```

**Structure Decision**: Single-project React SPA. All changes within existing `src/` directory. Two new components (`Header.tsx`, `Footer.tsx`) for shared branding.

---

## Proposed Changes

### Component 1: Data Layer Updates

> University ID format change, isRepeated field, academic level threshold update.

#### [MODIFY] [student.ts](file:///F:/Coding%20projects/damietta-university-academic-advisor/src/types/student.ts)

- Change `universityId` format from `YYYY-NNNN` to `YYYYNNNN` (no hyphen)
- Update `generateUniversityId()` to produce hyphen-free IDs
- Add `isRepeated: boolean` field to `PassedCourseRecord` interface (default: `false`)

#### [MODIFY] [gradeUtils.ts](file:///F:/Coding%20projects/damietta-university-academic-advisor/src/lib/gradeUtils.ts)

- Update `inferAcademicLevel()` thresholds: 30 → 2, 66 → 3, 102 → 4 (was 30/60/90)
- Update `calculateGPA()` to cap grade points at 3.0 for records where `isRepeated === true`
- Add `getAcademicStanding(gpa: number): 'Good' | 'Observation'` helper
- Add `getMaxCreditLoad(gpa: number): number` helper (returns 12 if GPA < 2.0, 19 otherwise)

---

### Component 2: Recommendation Algorithm Redesign

> Replace the bucket-first algorithm with 4-phase weighted scoring engine.

#### [MODIFY] [roadmapLogic.ts](file:///F:/Coding%20projects/damietta-university-academic-advisor/src/lib/roadmapLogic.ts)

**Major rewrite** of the `generateRoadmap()` function while preserving its signature and return type.

**Phase 1 — Academic Status Evaluation** (replaces inline GPA/load check):
- Calculate total earned credits
- Determine academic level using updated thresholds (30/66/102)
- Calculate CGPA and determine academic standing
- Set max credit load (12 for observation, 19 for good standing)

**Phase 2 — Course Filtering** (replaces bucket population):
- Major filtering: general program for levels 1–2, specialization at level 3+
- Prerequisite checking: exclude courses with unmet prereqs
- Elective truncation: stop recommending from categories where credit requirements are met

**Phase 3 — Weight Scoring Engine** (replaces level-first sorting):
- Score every valid course with weights:
  - Failed/missed mandatory courses from lower levels: **100**
  - Bottleneck prerequisites (courses that unlock many future requirements): **50**
  - Current-level mandatory courses: **25**
  - Elective courses: **10**
- Sort descending by weight, then by chain depth as tiebreaker

**Phase 4 — Schedule Generation** (replaces sequential fill):
- Select courses from priority queue until max credit load reached
- Graduation check: track progress toward 140 credit hours with CGPA ≥ 2.0
- Summer training constraint: if `passedHours >= 70` and `currentTerm === 3` and summer training not passed, block all course recommendations

**Preserved**: Function signature `generateRoadmap(student, currentTerm, coursesInput?)`, return type `{ roadmap, log, bucketStatuses }`, existing helper functions for prerequisite checking and dependent counting.

---

### Component 3: UI Branding & Layout

> Modern faculty-branded UI with logo, primary color, and social footer.

#### [NEW] [Header.tsx](file:///F:/Coding%20projects/damietta-university-academic-advisor/src/components/Header.tsx)

- Faculty logo (`cai-logo.png`) displayed on left
- Application title
- Navigation links (Student Portal / Admin Dashboard)
- User context (logged-in student name or admin indicator)
- Uses `#0160C9` as primary color

#### [NEW] [Footer.tsx](file:///F:/Coding%20projects/damietta-university-academic-advisor/src/components/Footer.tsx)

- Social media links: Facebook, Twitter/X, LinkedIn, university website
- "Developed by FaragallahTech © 2026" with `FaragallahTech logo.png` from resources folder
- Copyright notice
- Faculty contact info
- Uses `#0160C9` theme

#### [MODIFY] [index.css](file:///F:/Coding%20projects/damietta-university-academic-advisor/src/index.css)

- Add CSS custom properties for brand colors:
  - `--brand-primary: #0160C9`
  - `--brand-primary-dark: #014A9A`
  - `--brand-primary-light: #3B82F6`
  - `--brand-accent: #E0EDFF`
- Add modern design tokens (shadows, border radius, transitions)
- Override Tailwind's default indigo with brand blue

#### [MODIFY] [tailwind.config.js](file:///F:/Coding%20projects/damietta-university-academic-advisor/tailwind.config.js)

- Extend theme colors to include `brand` color palette based on `#0160C9`
- Add custom font family (Inter from Google Fonts)

#### [MODIFY] [App.tsx](file:///F:/Coding%20projects/damietta-university-academic-advisor/src/App.tsx)

- Wrap routes with shared `Header` and `Footer` components
- Add consistent page layout container

#### [MODIFY] [AdminDashboard.tsx](file:///F:/Coding%20projects/damietta-university-academic-advisor/src/pages/AdminDashboard.tsx)

- Replace all `indigo-*` / `blue-*` / `purple-*` color classes with `brand-*` equivalents
- Remove inline header (now in shared Header component)
- Add "Academic Observation" badge for students with CGPA < 2.0
- Update login page styling to match brand

#### [MODIFY] [StudentPortal.tsx](file:///F:/Coding%20projects/damietta-university-academic-advisor/src/pages/StudentPortal.tsx)

- Replace all `indigo-*` color classes with `brand-*` equivalents
- Remove inline header (now in shared Header component)
- **Lazy plan generation**: auto-generate plan on student login (dashboard view)
- **Blocked student plan hiding**: hide semester plan section when student is blocked
- Update the navigation bar styling

#### [MODIFY] [StudentForm.tsx](file:///F:/Coding%20projects/damietta-university-academic-advisor/src/components/StudentForm.tsx)

- Update University ID display format to `YYYYNNNN`
- Replace color classes with brand equivalents

#### [MODIFY] [StudentProfileView.tsx](file:///F:/Coding%20projects/damietta-university-academic-advisor/src/components/StudentProfileView.tsx)

- Add "Academic Observation" warning for CGPA < 2.0
- Add "Generate Plan" button for admin on-demand plan generation
- Replace color classes with brand equivalents
- Show `isRepeated` indicator on course records

#### [MODIFY] [index.html](file:///F:/Coding%20projects/damietta-university-academic-advisor/index.html)

- Add Google Fonts link for Inter font family
- Update page title and meta description

---

## Verification Plan

### Automated Tests

No automated test framework exists. TypeScript compilation is the primary check:

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

1. **Algorithm: New student standard plan** — Create a new CS student with no courses → Generate plan for Term 1 → Verify the output contains standard Level 1 Term 1 courses matching the bylaws

2. **Algorithm: Failed course priority** — Add a student with CS102 marked as Failed + other passed courses → Generate plan → Verify CS102 appears first in the recommended plan

3. **Algorithm: Academic observation load limit** — Set up a student with CGPA < 2.0 → Generate plan → Verify total credit load does not exceed 12 hours → Verify "Academic Observation" warning is displayed

4. **Algorithm: Elective truncation** — Set up a student who has completed 12 optional credit hours for their major → Generate plan → Verify no additional electives from that pool appear

5. **Algorithm: Summer training constraint** — Set up a student with 70+ credit hours → Generate plan for Term 3 (summer) → Verify summer courses are blocked and training notice is shown

6. **Algorithm: Repeated course grade cap** — Add a course with `isRepeated: true` and grade Excellent → Verify GPA calculation uses 3.0 (B) instead of 4.0

7. **University ID format** — Create a new student → Verify the generated University ID has format `YYYYNNNN` (no hyphen, e.g., `20260001`)

8. **Level thresholds** — Add courses to reach exactly 66 credit hours → Verify academic level shows Level 3 (was Level 2 under old thresholds)

9. **Student login + lazy plan** — Go to Student Portal → Login with University ID + National ID → Verify plan is auto-generated and displayed

10. **Blocked student plan hiding** — Login as a blocked student → Verify "Blocked" banner appears → Verify semester plan section is NOT visible → Verify profile and request history are still visible

11. **UI branding** — Verify the logo appears in the header on every page → Verify primary color is `#0160C9` (not indigo) → Verify footer with social links is visible → Verify responsive layout

12. **Data persistence** — Create student, generate plan, refresh page → Verify all data persists

## Complexity Tracking

No constitution violations to justify.
