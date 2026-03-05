
---

## N: Polish & Cross-Cutting Concerns

**Purpose**: Final review and assurance.

- [x] T001 [P] Update `StudentProfile` and `PassedCourseRecord` types in `src/types/student.ts` (add `isRepeated`, format `YYYYNNNN`)
- [x] T002 Update `generateUniversityId` logic in `src/types/student.ts` to output `YYYYNNNN` without hyphens
- [x] T003 Update `inferAcademicLevel` thresholds in `src/lib/gradeUtils.ts` (30/66/102)
- [x] T004 Update `calculateGPA` in `src/lib/gradeUtils.ts` to implement max B (3.0) grade cap for `isRepeated` courses
- [x] T005 [P] Add `getAcademicStanding` and `getMaxCreditLoad` helpers in `src/lib/gradeUtils.ts`
- [x] T006 [US1] Update `StudentForm.tsx` to display non-hyphenated University IDs for new and existing students
- [x] T007 [US1] Update `StudentProfileView.tsx` to include "Academic Observation" warning if CGPA < 2.0
- [x] T008 [US1] Update `StudentProfileView.tsx` course table to show `isRepeated` flag visually
- [x] T009 [US1] Update `AdminDashboard.tsx` student list to show "Observation" badges
- [x] T010 [US1] Add "Generate Plan" action button to `StudentProfileView.tsx` (connects to Phase 3)rc/lib/gradeUtils.ts`
- [x] T011 [P] [US2] Implement Phase 1 (Status Evaluation) inside `generateRoadmap` in `src/lib/roadmapLogic.ts`
- [x] T012 [P] [US2] Implement Phase 2 (Course Filtering: Major & Prerequisites) inside `generateRoadmap` 
- [x] T013 [P] [US2] Implement Phase 2b (Course Filtering: Elective Truncation) inside `generateRoadmap`
- [x] T014 [US2] Implement Phase 3 (Weight Scoring Engine) inside `generateRoadmap` (Failed=100, Bottleneck=50, Mandatory=25, Elective=10)
- [x] T015 [US2] Implement Phase 4 (Schedule Generation: max load & grad check) inside `generateRoadmap`
- [x] T016 [US2] Add Summer Training constraint to Phase 4 (block summer registration if `passedHours >= 70` and training not passed)

### Phase 4: User Story 3 - Student Views Semester Plan
- [x] T017 [US3] Update `StudentPortal.tsx` to auto-trigger `generateRoadmap` immediately upon successful authentication (`login` -> `dashboard`)
- [x] T018 [US3] Update `StudentPortal.tsx` to conditionally hide the semester plan view if `student.isBlocked === true`
- [x] T019 [US3] Update `StudentPortal.tsx` dashboard to display "Academic Observation" if CGPA < 2.0

### Phase 5: User Story 4 - Algorithm Supporting Functions
- [x] T020 [US4] Update `toStudentForRoadmap` inside `src/lib/gradeUtils.ts` to forward `failedCourses` logic, separating passes from permanent fails.
- [x] T021 [US4] Configure roadmap limits in `roadmapLogic.ts` directly based on `gpa < 2.0 ? 12 : 19`.
- [x] T022 [US4] Review sorting precedence: Failed (100) > Bottlenecks (50*dependents) > Mandatory (25) > Electives (10) > tie-break by level ascending.
- [x] T023 [US4] Update UI bucket logic mapping to provide continuous compatibility with the legacy view if needed.
- [x] T028 Perform manual verification of all 12 test scenarios listed in `plan.md`
- [x] T029 Clean up unused imports and test error states

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: Must be completed first as it touches core types and utilities used everywhere.
- **US1 & US2 (Phases 2 & 3)**: Can be developed in parallel after Setup. User Story 2 (Algorithm) is the most complex and critical path.
- **US3 (Phase 4)**: Depends on US1 (blocked status) and US2 (algorithm logic) being stable.
- **US4 (Phase 5 - UI)**: Can be largely executed in parallel with Phases 2-4, but should be finalized last to ensure all new states (Observation badger, blocked banners) are properly styled.

### Parallel Opportunities
- T020, T021 (UI Config) can be done immediately.
- T011-T013 (Algorithm phases 1 & 2) can be stubbed out simultaneously before wiring them together in T014.
- T025, T026 (Component class refactoring) can be done concurrently by different resources.
