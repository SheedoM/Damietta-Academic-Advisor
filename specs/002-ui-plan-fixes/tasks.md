# Tasks: UI Fixes and Plan Adjustments

**Input**: Design documents from `/specs/002-ui-plan-fixes/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

There are no major shared infrastructural setups required for these UI bug fixes. The system is already functional and running.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T001 Identify missing translation keys across major components (pre-requisite for US3)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Resolve Layout Overlaps and Tab Adjustments (Priority: P1) 🎯 MVP

**Goal**: Ensure sticky header does not overlap with content, move the overview statistics above tabs, and remove the degree progress bar and overview tab.

**Independent Test**: View any student profile, scroll down, and observe header and tab layout.

### Implementation for User Story 1

- [x] T002 [US1] Remove the 'overview' tab object from the tab navigation array in src/components/StudentProfileView.tsx
- [x] T003 [US1] Extract the overview statistics UI cards from the 'overview' tab condition and place them permanently above the Tab Navigation section in src/components/StudentProfileView.tsx
- [x] T004 [US1] Delete the Degree Progress bar UI completely from src/components/StudentProfileView.tsx
- [x] T005 [P] [US1] Fix sticky header overlap in src/pages/StudentPortal.tsx (ensure content below has sufficient margin/padding or the z-index is correct)
- [x] T006 [P] [US1] Fix sticky header overlap in src/pages/AdminDashboard.tsx
- [x] T007 [P] [US1] Fix sticky header overlap in src/components/StudentProfileView.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Admin Deletion of Course Plans (Priority: P1)

**Goal**: Allow admins to delete a course plan from a student's profile.

**Independent Test**: Navigate to a student profile with an existing plan, click the new Delete button, confirm, and verify the plan disappears.

### Implementation for User Story 2

- [x] T008 [US2] Add a 'Delete' button next to the 'Edit' and 'Approve' buttons for each rendered plan in src/components/StudentProfileView.tsx
- [x] T009 [US2] Implement the `handleDeletePlan(planId)` function inside src/components/StudentProfileView.tsx to filter out the target plan and call `updateStudent`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Comprehensive Arabic Translation Fixes (Priority: P2)

**Goal**: Ensure all UI elements use the `t()` function so Arabic localization works seamlessly across the app.

**Independent Test**: Toggle to Arabic and verify that all labels, headers, buttons, and placeholders are correctly translated.

### Implementation for User Story 3

- [ ] T010 [P] [US3] Add missing translation dictionary keys to src/context/LanguageContext.tsx
- [ ] T011 [P] [US3] Wrap hardcoded English strings in `t()` within src/pages/StudentPortal.tsx
- [ ] T012 [P] [US3] Wrap hardcoded English strings in `t()` within src/pages/AdminDashboard.tsx
- [ ] T013 [P] [US3] Wrap hardcoded English strings in `t()` within src/components/StudentProfileView.tsx
- [ ] T014 [P] [US3] Wrap hardcoded English strings in `t()` within src/components/StudentPlanEditor.tsx
- [ ] T015 [P] [US3] Wrap hardcoded English strings in `t()` within src/components/StudentForm.tsx

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: User Story 4 - Dynamic Year Inputs and Course Names in Plan Generation (Priority: P2)

**Goal**: Replace generic "Year X" selectors with numeric year inputs across plan generation, and display full course names in generated plans.

**Independent Test**: Generate a plan, use up/down arrows to set the year, and verify the output displays both the custom year and the full course names.

### Implementation for User Story 4

- [x] T016 [US4] Convert the 'Year 1' string select dropdown to a numeric input (type="number") `bulkPlanTargetYear` in src/pages/AdminDashboard.tsx
- [x] T017 [US4] Split the `planSemester` state in src/components/StudentProfileView.tsx into two controls: a Select for Term (Fall/Spring) and a numeric input for Year (e.g., 2026)
- [x] T018 [US4] Modify the roadmap rendering loop in src/components/StudentProfileView.tsx to render `{course?.name}` alongside the `{code}` pill for each generated course
- [x] T019 [US4] Update `StudentPlan.semester` logic to concatenate the Term Select and Year Input (e.g., `Fall 2026`) before saving or approving the plan in src/components/StudentProfileView.tsx

**Checkpoint**: All user stories are implemented.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T020 Run manual UI verification in the browser via `npm run dev` to ensure layout does not break in LTR vs RTL (Arabic) modes.
- [ ] T021 Validate deletion constraints (ensure deleted plans properly persist to local storage via the context).
- [ ] T022 Update tasks.md as tasks are completed.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A
- **Foundational (Phase 2)**: Quick investigation of translation dictionary keys.
- **User Stories (Phase 3+)**: US1 and US2 can run independently. US3 requires T001. US4 runs independently.
- **Polish (Final Phase)**: Runs last.

### Parallel Opportunities

- Sticky header styling fixes (T005, T006, T007) can be done in parallel.
- Wrapping components in translation logic (T011-T015) can be done in parallel for different component files.
