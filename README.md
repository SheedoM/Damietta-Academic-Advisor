# Damietta University Academic Advisor

A smart graduation roadmap generator for students of the Faculty of Computing and Artificial Intelligence at Damietta University. This tool helps students plan their academic path by generating personalized course recommendations based on their major, GPA, and passed courses, adhering to university bylaws and prerequisites.

## 🚀 Features

### Current (MVP)
- **Course Recommendation Engine:** Generates a course list for the *upcoming semester* based on a priority bucket system (University Mandatory, Basic Science, Major Requirements, etc.).
- **Prerequisite Validation:** Ensures all strict prerequisites are met before recommending a course.
- **GPA Load Management:** Adjusts the maximum credit hour load based on the student's GPA (< 2.0 vs ≥ 2.0).
- **Major Support:** Tailored logic for Computer Science (CS), Information Systems (IS), and Information Technology (IT).

### 🚧 Roadmap & Upcoming Features
- **Comprehensive Graduation Plan:** Generate full multi-semester roadmaps until graduation (Priority #1).
- **Admin Dashboard:**
    - UI to add/edit course details.
    - Semester-specific course availability management.
- **Visual Enhancements:** Color-coded course labels (Mandatory, Elective, etc.).
- **Student Services:** Ticket system for direct communication with the Dean.
- **AI Integration:** MCP Server Setup for interactive chat and guidance via LLMs.

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
