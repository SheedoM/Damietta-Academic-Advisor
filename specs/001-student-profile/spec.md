# Feature Specification: Student Profile & Semester Planning System

**Feature Branch**: `001-student-profile`  
**Created**: 2026-02-24  
**Updated**: 2026-03-03  
**Status**: Revision — Algorithm Redesign + UI Overhaul  
**Input**: User description: "Student Profile with semester plan generation, admin blocking, redesigned recommendation algorithm (4-phase weighted scoring engine), modernized UI matching faculty branding (#0160C9 + logo)."

## Clarifications

### Session 2026-02-24

- Q: What are the basic student profile fields for a new (non-transfer) student? → A: Minimal fields only: name, national ID. Additional profile fields will be gathered from stakeholders in a future iteration.
- Q: How should the "Transfer Student" toggle work? → A: By default, admin adds a new student with no prior academic records. When the transfer toggle is enabled, additional fields appear: courses taken, grades, GPA, previous university. The transfer section is the only place where prior course data is entered at creation time.
- Q: Should GPA and academic level be manually entered or computed? → A: Both GPA and academic level MUST be inferred/calculated from the student's past courses and their grades—never manually entered.
- Q: What grading scale should be used for recording course grades? → A: Egyptian university scale: Excellent (3.6–4.0), Very Good (2.8–3.59), Good (2.0–2.79), Pass (1.0–1.99), Fail (0).
- Q: What format should the system-generated University ID follow? → A: Year-sequence format without hyphen (e.g., `20260001`). The system generates this automatically when a student profile is created.
- Q: How are student profiles created? → A: Dual-path: (1) Admin can manually create a student. (2) If a student submits a registration request for the first time, the system auto-creates a profile using the submitted details. On subsequent semesters, the existing profile is reused—no need to re-enter details, major, or level.
- Q: How do students authenticate? → A: Students enter their University ID + National ID as a verification pair. The system checks that both match a stored profile before granting access. No separate password system needed.
- Q: Are registration requests tied to student profiles? → A: Yes. Each request is linked to a student via University ID. Students search by their University ID in the portal to see all their requests across semesters.
- Q: Can admins block students? → A: Yes. Admin can block/unblock a student. A blocked student sees a "blocked" status when they log in and cannot submit new requests.
- Q: When are past courses available during profile creation? → A: Past courses are ONLY available when the Transfer Student toggle is on. New (non-transfer) students start with zero courses—their courses accumulate through the registration request flow over semesters.
- Q: What happens when an admin blocks a student? → A: Read-only access. The student can still log in and view their profile and request history, but sees a "Blocked" banner and cannot submit new registration requests.
- Q: How does a student receive their University ID? → A: Admin creates the student profile with their National ID and either enters a University ID manually or the system generates one. The admin communicates the University ID to the student. The student then uses this ID in the portal to track their requests.
- Q: Does the system need a separate student dashboard? → A: No. The existing student portal is enhanced: students enter their University ID to view their request history, academic status, and submit new requests. No separate login page or dashboard needed—just the existing portal with University ID lookup + lightweight auth.

### Session 2026-03-03 — Revision

- Recommendation algorithm is being redesigned from a bucket-first approach to a 4-phase weighted scoring engine, as described below.
- Academic level thresholds updated to match bylaws: Level 1 (0–29h), Level 2 (30–65h), Level 3 (66–101h), Level 4 (102+h).
- CGPA below 2.0 places student under academic observation, restricting credit load.
- Failed/repeated course handling: student must repeat failed courses; maximum grade awarded for a repeated failed course is capped at B (83%).
- Summer training: students reaching 70 credit hours enter mandatory 3-week field training and are blocked from summer semester registration.
- UI is being modernized to match faculty branding: primary color #0160C9, faculty logo, social links, professional design.

### Session 2026-03-03 — Clarification

- Q: What format should the University ID use? → A: The University ID format is `YYYYNNNN` with no hyphen between the year and sequence number (e.g., `20260001` not `2026-0001`).
- Q: How are semester plans generated? → A: Plans are auto-generated when the student logs in (lazy generation). Admins can also manually generate a plan from the student profile. Blocked students cannot see their semester plan.
- Q: What weight values should the scoring engine tiers use? → A: Failed/Missed=100, Bottleneck Prerequisites=50, Current-Level Mandatory=25, Electives=10.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Creates and Manages Student Profiles (Priority: P1)

An admin opens the Admin Dashboard and navigates to the "Students" section. They can create student profiles (with optional transfer toggle), register courses with grades, view computed GPA/level, block/unblock students, and edit profile details. All computed fields (GPA, level, hours) update automatically.

**Why this priority**: Without student profiles, no other feature can function. This is the foundational data entry point.

**Independent Test**: Create a student, add courses with grades, verify computed GPA and level. Toggle block status and verify badge appears.

**Acceptance Scenarios**:

1. **Given** the admin is on the Students page, **When** they click "Add Student" and fill in name and national ID, **Then** the student is saved with GPA 0.0 and academic level 1.
2. **Given** a student exists, **When** the admin adds passed courses with grades, **Then** GPA is calculated using the weighted average and level is inferred from total passed hours using the updated thresholds (30/66/102).
3. **Given** the admin enables the "Transfer Student" toggle, **Then** fields for "Previous University" and a course/grade registration section appear.
4. **Given** a student has CGPA below 2.0, **When** viewing the student profile, **Then** an academic observation warning is displayed.
5. **Given** the admin toggles the "Block" switch for a student, **Then** the student list shows a "Blocked" badge and the student's portal access becomes read-only.

---

### User Story 2 - Semester Plan Generation via Redesigned Algorithm (Priority: P1)

Each semester, the system generates a personalized semester plan for each student. The recommendation algorithm follows a 4-phase approach: (1) evaluate academic status and determine load capacity, (2) filter courses by major and prerequisites, (3) score eligible courses using a weight priority queue, and (4) allocate courses up to the load limit while checking graduation constraints.

**Why this priority**: This is the core intellectual value of the system—automating academic advising with a smart algorithm that handles both regular and irregular student paths.

**Independent Test**: Load a student profile with mixed passed/failed courses, generate a semester plan, and verify the output prioritizes failed courses first, then bottleneck prerequisites, then current-level mandatory courses, then electives.

**Acceptance Scenarios**:

1. **Given** a new student with no failed courses, **When** a plan is generated, **Then** the output matches the standard sequential plan from the bylaws for their major and current level.
2. **Given** a student has failed CS102, **When** a plan is generated, **Then** CS102 appears at the top of the recommended courses with the highest priority weight.
3. **Given** a student is under academic observation (CGPA < 2.0), **When** a plan is generated, **Then** the maximum credit load is restricted (e.g., 12 credits instead of 19).
4. **Given** a student has met the required 12 optional credit hours for their major, **When** a plan is generated, **Then** no additional electives from that pool are recommended.
5. **Given** a student has reached 70 credit hours, **When** summer training is the next required milestone, **Then** the algorithm blocks summer semester course registration and flags the training requirement.
6. **Given** a student with a repeated failed course earns an Excellent grade, **When** GPA is recalculated, **Then** the grade is capped at B (83%) for that course.

---

### User Story 3 - Student Views Semester Plan (Priority: P2)

The student logs in using their University ID + National ID. After authentication, the system auto-generates their personalized semester plan on the fly and displays it alongside their academic status summary and request history. If the student is blocked, they see a "Blocked" banner and cannot view their semester plan or submit new requests—they can only view their profile and past request history.

**Why this priority**: The student-facing experience is how the system delivers value to end users, but depends on the algorithm and profiles being functional first.

**Independent Test**: Log in as a student, verify the display of semester plan, GPA, level, and blocked status. Attempt to submit a request while blocked and verify it is prevented.

**Acceptance Scenarios**:

1. **Given** a student logs in, **When** they are not blocked, **Then** the system auto-generates and displays their semester plan with course codes, names, credits, and total credit load.
2. **Given** a student is blocked, **When** they log in, **Then** a "Blocked" banner is displayed, the semester plan is hidden, and the submit button is disabled. They can only view their profile and request history.
3. **Given** the student views their dashboard, **Then** they see: GPA, academic level, total passed hours, graduation progress (X/140 hours), and academic standing.

---

### User Story 4 - Modern Faculty-Branded UI (Priority: P2)

The entire application UI is redesigned to match the faculty's official branding. The primary color is #0160C9 (faculty blue), the faculty logo (`cai-logo.png`) is displayed in the header, and the design is modern and professional with social media links in the footer.

**Why this priority**: A professional-looking interface builds trust with administrators and students. The UI must match institutional standards.

**Independent Test**: Visually verify the application uses the faculty color scheme, logo is displayed, social links are present, and the design feels modern/professional.

**Acceptance Scenarios**:

1. **Given** a user opens the application, **Then** the primary color throughout the UI is #0160C9 (not indigo/purple).
2. **Given** any page of the application, **Then** the faculty logo is displayed in the header/navigation.
3. **Given** any page of the application, **Then** a footer with social media links is visible.
4. **Given** the application is viewed on different screen sizes, **Then** the layout adapts responsively while maintaining branding consistency.

---

### Edge Cases

- What happens when a student has no passed courses at all? GPA should be 0.0, academic level should be 1, and the system should generate a first-semester plan based on their major.
- How does the system handle a transfer student who has passed courses that do not exist in the university's course database? The system should flag unrecognized courses and allow the admin to manually map them to equivalent university courses or skip them.
- What happens when the admin deletes a student profile? The system should confirm the action and remove all associated data (passed courses, grades, etc.).
- How does the system handle a student changing their major from CS to IT? The recommendation engine should recalculate which courses are mandatory vs. elective under the new major.
- What happens if a course grade is changed after initial registration? GPA and academic level should recalculate automatically.
- How is academic level inferred? Based on total passed credit hours: Level 1 (0–29h), Level 2 (30–65h), Level 3 (66–101h), Level 4 (102+h).
- What happens when a blocked student tries to access the portal? The system shows a "Blocked" banner, hides the semester plan, and disables the submit request button. The student can only view their profile details and past request history.
- What happens when a student has failed a course multiple times? Each failure is recorded. The student must repeat the course. On passing, the maximum grade recorded is capped at B.
- What happens when the algorithm cannot fill the full credit load? The plan is generated with whatever courses are available, and a note indicates remaining capacity.
- What happens to summer courses if the student has reached 70 credit hours? The system checks for the summer training constraint and blocks summer course registration, displaying a notice about mandatory field training.

## Requirements *(mandatory)*

### Functional Requirements

**Student Profile Management (existing, retained)**

- **FR-001**: System MUST allow admins to create student profiles with: student name, national ID, and major.
- **FR-002**: System MUST validate all student profile fields—preventing empty required fields and duplicate national IDs.
- **FR-003**: System MUST allow admins to register passed courses for a transfer student from the existing course database, with a grade for each using the Egyptian grading scale.
- **FR-004**: System MUST automatically calculate total passed credit hours when courses are added or removed.
- **FR-005**: System MUST automatically calculate GPA from the weighted average of course grades and credit hours. GPA MUST NOT be manually editable.
- **FR-006**: System MUST automatically infer academic level from total passed credit hours: Level 1 (0–29h), Level 2 (30–65h), Level 3 (66–101h), Level 4 (102+h).
- **FR-007**: System MUST provide a "Transfer Student" toggle that reveals: previous university name field and a course/grade registration section.
- **FR-008**: System MUST treat transferred courses as equivalent passed courses for graduation requirements.
- **FR-009**: System MUST display a searchable and sortable student list in the Admin Dashboard.
- **FR-010**: System MUST allow admins to view a student's full profile including all computed details.
- **FR-011**: System MUST allow admins to edit student profiles and have computed fields recalculate automatically.
- **FR-012**: System MUST allow admins to delete a student profile with confirmation.
- **FR-013**: System MUST persist student data locally so it survives page refreshes.
- **FR-014**: System MUST generate a unique University ID (`YYYYNNNN` format, no hyphen, e.g., `20260001`) or allow admin entry.
- **FR-015**: System MUST authenticate students by University ID + National ID pair.
- **FR-016**: System MUST allow admins to block/unblock students. Blocked students see a "Blocked" banner, cannot view their semester plan, and cannot submit new requests. They retain access to view their profile and request history only.

**Recommendation Algorithm Redesign (new)**

- **FR-017**: System MUST implement Phase 1 — Academic Status Evaluation: calculate total earned credits, determine academic level (30/66/102 thresholds), calculate CGPA, and determine max credit load (restricted for CGPA < 2.0).
- **FR-018**: System MUST implement Phase 2 — Course Filtering: restrict courses by student's specialization (general program for levels 1–2, specialization at level 3+), enforce prerequisite checking, and truncate elective pools when category credit requirements are met.
- **FR-019**: System MUST implement Phase 3 — Weight Scoring Engine: assign mathematical weights to valid courses and sort in descending order. Weight tiers: failed/missed courses (highest), bottleneck prerequisites (high), current-level mandatory courses (medium), elective courses (low).
- **FR-020**: System MUST implement Phase 4 — Schedule Generation: select courses from the priority queue until max credit load is reached, verify graduation alignment (140 credit hours, CGPA ≥ 2.0), and enforce the summer training constraint (70+ hours blocks summer registration).
- **FR-021**: System MUST cap the maximum grade for a repeated failed course at B (83%).
- **FR-022**: System MUST display an "Academic Observation" warning for students with CGPA below 2.0.
- **FR-023**: System MUST generate semester plans that match the standard sequential bylaw plan for new students with no irregularities.

**UI Redesign (new)**

- **FR-024**: System MUST use #0160C9 as the primary brand color throughout the entire UI, replacing all existing indigo/purple/generic colors.
- **FR-025**: System MUST display the faculty logo (`cai-logo.png` from the resources folder) in the application header.
- **FR-026**: System MUST include a footer with social media links (Facebook, Twitter/X, LinkedIn, and university website), and a "Developed by FaragallahTech © 2026" credit with the FaragallahTech logo (`FaragallahTech logo.png` from the resources folder).
- **FR-027**: System MUST have a modern, professional design with smooth transitions, hover effects, and responsive layout.

### Key Entities

- **Student Profile**: Name, national ID (unique), university ID (`YYYYNNNN`, no hyphen), major (CS/IT/IS/General), transfer status, previous university, blocked status, passed courses list. Computed: GPA, academic level, total passed hours, academic standing (good/observation).
- **Passed Course Record**: Course code, grade (Excellent/Very Good/Good/Pass/Fail), grade points, transferred flag, isRepeated flag, original fail record reference.
- **Semester Plan**: Generated output linking a student to a set of recommended courses for the upcoming term. Includes: course list with weights, total credit load, generation log, bucket status summary.
- **Registration Request** (existing, extended): Linked to student profile via university ID. Preserves history across semesters.
- **Course** (existing): No changes to entity, but gains new relationships via the weight scoring engine.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The algorithm for a new student with no failed courses produces a semester plan identical to the standard bylaw plan for that major and level.
- **SC-002**: Failed courses always appear first in the generated plan with the highest priority weight.
- **SC-003**: Students under academic observation (CGPA < 2.0) never receive a plan exceeding the restricted credit load.
- **SC-004**: Elective pools stop contributing courses once their category credit requirement is met.
- **SC-005**: Academic level thresholds (30/66/102) match the university bylaws exactly.
- **SC-006**: The faculty logo and primary color (#0160C9) are consistently visible on every page.
- **SC-007**: Admins can create a student profile and generate a semester plan in under 3 minutes.
- **SC-008**: 100% of student profiles persist across page refreshes.
- **SC-009**: GPA calculation accuracy is 100% across all test cases using the Egyptian grading scale.
- **SC-010**: The summer training constraint correctly blocks course registration when the student has 70+ credit hours.

## Assumptions

- Student data is stored client-side (localStorage) since the application has no backend server.
- The existing course database remains unchanged; the algorithm redesign works with the same course data.
- GPA formula: sum(grade_points × credit_hours) / sum(credit_hours).
- Grade point mapping: Excellent = 4.0, Very Good = 3.0, Good = 2.0, Pass = 1.0, Fail = 0.0.
- Academic level thresholds: Level 1 (0–29h), Level 2 (30–65h), Level 3 (66–101h), Level 4 (102+h). These match the bylaws provided by the user.
- The "General" major type covers students who haven't selected a specialization; they follow a common program during levels 1–2.
- Maximum credit load: 19 hours for students in good standing, 12 hours for students under academic observation (CGPA < 2.0).
- Total graduation requirement: 140 credit hours with a minimum CGPA of 2.0.
- The grade cap for repeated failed courses (max B/83%) applies only to courses initially failed, not to first-attempt courses.
- Social media links in the footer use placeholder URLs that can be updated by the admin in a future iteration.
- The `cai-logo.png` in the resources folder is the official faculty logo to use for branding.
