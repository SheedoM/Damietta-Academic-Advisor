# Implementation Plan: UI Fixes and Plan Adjustments

**Branch**: `002-ui-plan-fixes` | **Date**: 2026-03-06 | **Spec**: [specs/002-ui-plan-fixes/spec.md](spec.md)
**Input**: Feature specification from `/specs/002-ui-plan-fixes/spec.md`

## Summary

This feature resolves various UI and localization issues across the system: removing the sticky header overlap, repositioning the Student Profile overview, allowing numeric year inputs instead of "Year X" dropdowns, enabling admins to delete generated plans, showing course names alongside course codes in the plan, and fixing the Arabic translations so that the entire interface is reactive to language toggles.

## Technical Context

**Language/Version**: TypeScript / React 18
**Primary Dependencies**: React Router, Tailwind CSS, Lucide React
**Storage**: Local state / Context API (Mock Data)
**Testing**: Manual UI Testing
**Target Platform**: Web browsers
**Project Type**: front-end web application
**Performance Goals**: N/A
**Constraints**: Fully responsive UI and proper RTL/LTR support for translations.
**Scale/Scope**: ~10 screens

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Test-First**: Verified. We will provide manual UI acceptance criteria to ensure features work.
- **Simplicity**: Verified. The UI solutions prioritize minimal component refactoring over complex redesigns.

## Project Structure

### Documentation (this feature)

```text
specs/002-ui-plan-fixes/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── layout/
│   │   └── Header.tsx
│   ├── StudentProfileView.tsx
│   └── StudentPlanEditor.tsx
├── pages/
│   ├── AdminDashboard.tsx
│   └── StudentPortal.tsx
└── context/
    ├── LanguageContext.tsx
    └── StudentContext.tsx
```

**Structure Decision**: A single front-end React project structure.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
