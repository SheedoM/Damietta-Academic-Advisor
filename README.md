# Damietta University Academic Advisor

A smart graduation roadmap generator for students of the Faculty of Computing and Artificial Intelligence at Damietta University. This tool helps students plan their academic path by generating personalized course recommendations based on their major, GPA, and passed courses, adhering to university bylaws and prerequisites.

## 🚀 Features

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
- [ ] **Visual Course Labeling:** Distinct UI indicators for course types (Mandatory, Elective, etc.).
- [ ] **Advanced Prereqs:** Handling credit-hour threshold prerequisites (e.g., "Must pass 70 hours").

### 🔮 Phase 3: Admin & Advanced Features
- [ ] **Admin Dashboard:**
    - Add/Edit Course details via UI.
    - Manage "Available Courses" for upcoming semesters.
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

---
*Built with ❤️ for Damietta University Students.*
