# Damietta University Academic Advisor

A smart graduation roadmap generator for students of the Faculty of Computing and Artificial Intelligence at Damietta University. This tool helps students plan their academic path by generating personalized course recommendations based on their major, GPA, and passed courses, adhering to university bylaws and prerequisites.

## � Recent Incident Reports

### Multi-Semester Roadmap Algorithm Failure (Jan 2026)
We attempted to introduce a "Multi-Semester" feature to recommend courses for future terms. It failed due to conflicting optimization goals:
- **Legacy Algo (Bucket-Priority):** Excellent for Graduation Requirements (Seniors), poor for Freshman balance.
- **New Algo (Sequence-based):** Excellent for Freshmen, but "Too Greedy" and broke specific mandatory requirements for Seniors.
**Resolution:** Reverted to Legacy Algorithm. Future plan is to implement a **Unified Weighted Score** system.
[Read full analysis](incident_report.md)

## �🚀 Features

### Current (MVP)
- **Course Recommendation Engine:** Generates a course list for the *upcoming semester* based on a priority bucket system (University Mandatory, Basic Science, Major Requirements, etc.).
- **Prerequisite Validation:** Ensures all strict prerequisites are met before recommending a course.
- **GPA Load Management:** Adjusts the maximum credit hour load based on the student's GPA (< 2.0 vs ≥ 2.0).
- **Major Support:** Tailored logic for Computer Science (CS), Information Systems (IS), and Information Technology (IT).

## 📅 Project Phases & Progress

### ✅ Phase 1: Foundation & Setup (Completed)
- [x] **Project Initialization:** Structure set up with React, TypeScript, and Vite.
- [x] **Repository Setup:** GitHub repo created and organized.
- [x] **Basic Logic Engine:** Implemented Priority Priority Bucket System for course selection.
- [x] **Prerequisite Check:** Logic to handle strict course dependencies.
- [x] **Basic UI:** Input form for student data and simple result display.

### 🚧 Phase 2: Recommendation Engine V2 (In Progress)
- [ ] **Multi-Semester Planning:** Generate complete roadmap from current state to graduation (Priority #1).
- [x] **Visual Course Labeling:** Distinct UI indicators for course types (Mandatory/Elective) with Color Coding.
- [x] **Structured Logs:** Improved readability of generation logs.
- [ ] **Advanced Prereqs:** Handling credit-hour threshold prerequisites (e.g., "Must pass 70 hours").
- [ ] **Bug Fix:** Graduation Project not appearing (Investigate "999 prerequisites" / Credit Hour check).

### 🔮 Phase 3: Admin & Advanced Features
- [ ] **Admin Dashboard (`feature/admin-ui` branch):**
    - [/] Initial Routing & List View (Implemented on branch).
    - [ ] Add/Edit Course details via UI.
    - [ ] Manage "Available Courses" for upcoming semesters.
- [ ] **Student Services:** Ticket submission system for Dean review (Priority #2).
- [ ] **Dynamic Data:** Switch from static code definitions to Database/JSON driven content manageable by Admins.

### 🤖 Phase 4: AI Integration
- [ ] **MCP Server:** Add Model Context Protocol support.
- [ ] **Interactive Assistant:** LLM-powered bot to explain recommendations and answer bylaws questions (Priority #3).

## 🛠️ Tech Stack
- **Frontend:** React, TypeScript, Vite
- **Styling:** Tailwind CSS
- **State Management:** React Hooks
- **Data Source:** JSON-based course catalog (Hardcoded initial set from University Bylaws)

## 📦 Getting Started

1.  Clone the repository:
    ```bash
    git clone https://github.com/SheedoM/Damietta-Academic-Advisor.git
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the development server:
    ```bash
    npm run dev
    ```

## 📄 Project Structure
- `src/data`: Course definitions and static data.
- `src/lib`: Core logic for roadmap generation and prerequisite checking.
- `src/types`: TypeScript interfaces for robust type safety.
- `resources/`: Raw data files (PDFs, text catalogs).

## 🧠 Application Logic: Allocation Algorithm

The core of the Academic Advisor is a deterministic **Priority Bucket System** that simulates the decision-making process of a human academic advisor. It ensures students graduate in the minimum time possible while adhering to strict university bylaws.

### 1. Bucket Prioritization
Courses are categorized into "Buckets" which are filled in a specific order. The algorithm attempts to fill the student's schedule starting from the highest priority bucket:
1.  **University Mandatory:** (Priority 1) - Courses required for all students (e.g., Human Rights).
2.  **Basic Science Mandatory:** (Priority 2) - Core Math and Science foundations.
3.  **Basic Science Elective:** (Priority 3) - Flexible Science credits (e.g., Physics vs Chemistry).
4.  **College Mandatory:** (Priority 4) - Core computing courses required for all majors.
5.  **College Elective:** (Priority 5) - Shared electives across the faculty.
6.  **Major Mandatory:** (Priority 6) - Specific deep-dive courses for CS/IS/IT.
7.  **Major Elective:** (Priority 7) - Specialized electives within the major.
8.  **Projects & Training:** (Priority 8) - Graduation projects and summer training.

### 2. Selection Process (Per Semester)
For each simulated semester, the algorithm:
1.  **Calculates Max Load:** Defaults to 18 Credit Hours (or 12 if GPA < 2.0).
2.  **Filters Candidates:**
    - Must be offered in the current semester (Fall/Spring).
    - Student must NOT have already passed it.
    - **Strict Prerequisite Check:** All immediate prerequisites must be passed.
3.  **Fills Logic:**
    - Iterates through Buckets 1 → 8.
    - Adds eligible courses to the schedule until the `Max Load` is reached.
    - Prioritizes "blocking" courses (prerequisites for future critical paths) implicitly by the bucket order.

---
*Built with ❤️ for Damietta University Students.*
