# Damietta University — Academic Advisor

A graduation planning tool for students of the **Faculty of Computing and Artificial Intelligence** at Damietta University. It generates personalized semester-by-semester course recommendations based on the student's major, GPA, passed courses, and university bylaws.

## Features

### Student Portal
- **Remaining Courses View** — shows all outstanding courses grouped by category (University, Basic Science, College, Major) with per-category progress bars tracking mandatory and elective completion.
- **Roadmap Generator** — produces a recommended course plan for the upcoming semester using a priority-based scoring algorithm that respects prerequisites, GPA-based credit limits, and term availability.
- **Training & Project Tracking** — placeholder sections for field training (3 Cr) and graduation project (6 Cr) visible to all students.
- **Ticket Submission** — students can attach a support ticket when submitting their plan for advisor review.
- **Request Tracking** — look up the status of a previously submitted request by tracking number.
- **Transcript Input** — accepts passed courses via JSON array for quick bulk entry.

### Admin Dashboard
- **Course Management** — view, add, edit, and toggle availability of all 119 courses across 6 categories. Courses can be filtered and searched.
- **Request Review** — view and respond to student-submitted plans and tickets.
- **Add/Edit Course** — full form with code, name, credits, term (Term 1 / Term 2 / Summer), level, category, prerequisites, and requirement type.
- **Availability Toggle** — disable courses from appearing in student recommendations without deleting them.

### Course Engine
- **119 unique courses** across 6 categories: University Requirements, Basic Science, College Requirements, CS Major, IT Major, IS Major.
- **Cross-listed course support** — courses shared across majors (e.g., CS437 in both CS and IS) are correctly counted and displayed for each major.
- **Prerequisite validation** — strict prerequisite checks before any course is recommended.
- **GPA-based load management** — 18 Cr cap for GPA ≥ 2.0, 12 Cr for GPA < 2.0.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS |
| Routing | React Router v6 |
| State | React Context + Hooks |
| Storage | localStorage (client-side) |
| Data | JSON course catalog (`courses.json`) |

## Getting Started

```bash
# Clone
git clone https://github.com/SheedoM/Damietta-Academic-Advisor.git
cd Damietta-Academic-Advisor

# Install
npm install

# Dev server
npm run dev

# Production build
npm run build
```

## Project Structure

```
src/
├── pages/
│   ├── StudentPortal.tsx      # Student-facing UI (courses, roadmap, tickets)
│   └── AdminDashboard.tsx     # Admin panel (course management, requests)
├── data/
│   ├── courses.json           # Full course catalog (6 categories, 119 courses)
│   └── courseDatabase.ts      # Course lookup helpers and category utilities
├── lib/
│   └── roadmapLogic.ts        # Roadmap generation algorithm
├── context/
│   └── CourseContext.tsx       # Global course state provider
├── types/
│   ├── index.ts               # Core types (Student, Course, Major, Term)
│   └── request.ts             # Student request / ticket types
├── components/
│   └── StudentPlanEditor.tsx   # Plan editing component
└── App.tsx                     # Root routes (/ → Student, /admin → Admin)

resources/                      # Raw reference data (bylaws, catalogs)
scripts/                        # Data processing scripts
```

## Roadmap Algorithm

The recommendation engine uses a **priority bucket system with global scoring**:

1. **Bucket Prioritization** — courses are grouped into priority tiers:
   - P1: University Mandatory → P2: Basic Science Mandatory → P3: Basic Science Elective
   - P4: College Mandatory → P5: College Elective
   - P6: Major Mandatory → P7: Major Elective → P8: Projects & Training

2. **Candidate Filtering** — for each course, the engine checks:
   - Offered in the current term (Term 1 / Term 2)
   - Not already passed
   - All prerequisites satisfied
   - Course is toggled available by admin

3. **Global Scoring** — all candidates are scored and sorted globally, then selected while respecting per-bucket limits and the student's credit hour cap.

## Future Development

### 🔐 Admin Security
The current admin authentication uses client-side SHA-256 password hashing — a basic deterrent, not real security. Future work:
- Server-side authentication with proper session management
- Role-based access control (admin vs. advisor vs. read-only)
- Audit logging for course changes

### 🧮 Roadmap Algorithm Redesign
The current bucket-priority algorithm works for most cases but has known limitations with cross-semester planning and freshman course balance. Planned improvements:
- Complete algorithm redesign with a unified weighted scoring system
- Multi-semester planning (full path from current state to graduation)
- Smarter handling of elective slots and prerequisite chains
- Configurable scoring weights for different optimization goals

### 💾 Persistent Storage
The application currently uses `localStorage` for all state (course toggles, requests, tickets). This means data is per-browser and easily lost. Planned migration:
- Backend API with a proper database (PostgreSQL or Firebase)
- Persistent course availability state across sessions and devices
- Student request history and admin ticket management
- Data backup and export capabilities

### 🎨 UI Improvements
- Responsive mobile-first redesign
- Dark mode support
- Drag-and-drop course plan editor
- Visual prerequisite dependency graph
- Print-friendly roadmap export

### 🤖 AI-Powered Advisor Bot
An LLM-powered assistant integrated into the student portal to:
- Explain *why* specific courses were recommended and in what order
- Answer questions about university bylaws, prerequisites, and graduation requirements
- Suggest alternative plans based on student preferences (lighter load, specific electives, etc.)
- Provide natural-language interaction for exploring "what-if" scenarios

---

*Built for Damietta University students — Faculty of Computing and Artificial Intelligence.*
