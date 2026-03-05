# Quickstart: Student Profile Feature

**Branch**: `001-student-profile` | **Date**: 2026-02-24

## Prerequisites

- Node.js 18+ installed
- `npm install` completed in project root

## Development Commands

```bash
# Start dev server
npm run dev
# → http://localhost:5173

# Type check
npx tsc --noEmit

# Build
npm run build
```

## Key File Locations

| What | Path |
|------|------|
| Student types & CRUD | `src/types/student.ts` |
| Request types & CRUD | `src/types/request.ts` |
| Grade utilities (GPA, level) | `src/lib/gradeUtils.ts` |
| Student state context | `src/context/StudentContext.tsx` |
| Student form (admin) | `src/components/StudentForm.tsx` |
| Student profile viewer | `src/components/StudentProfileView.tsx` |
| Admin dashboard | `src/pages/AdminDashboard.tsx` |
| Student portal | `src/pages/StudentPortal.tsx` |

## Feature Flow

```mermaid
graph TD
    A[Admin creates student] --> B[University ID generated]
    B --> C[Admin communicates ID to student]
    C --> D[Student enters University ID + National ID in portal]
    D --> E{Auth check}
    E -->|Pass| F[Student dashboard: status + history]
    E -->|Fail| G[Error message]
    F --> H{Blocked?}
    H -->|No| I[Submit new request]
    H -->|Yes| J[Read-only view + banner]
    I --> K[Request linked to profile]
    K --> F
```
