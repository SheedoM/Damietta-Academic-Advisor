# Feature Specification: Comprehensive Student Profile

**Feature Branch**: `001-student-profile`  
**Created**: 2026-02-24  
**Status**: Draft  
**Input**: User description: "Build a comprehensive student profile with all student details, courses registered, transfer student support, and recommendation plan based on comprehensive student status."

## Clarifications

### Session 2026-02-24

- Q: What are the basic student profile fields for a new (non-transfer) student? → A: Minimal fields only: name, national ID. Additional profile fields will be gathered from stakeholders in a future iteration.
- Q: How should the "Transfer Student" toggle work? → A: By default, admin adds a new student with no prior academic records. When the transfer toggle is enabled, additional fields appear: courses taken, grades, GPA, previous university. The transfer section is the only place where prior course data is entered at creation time.
- Q: Should GPA and academic level be manually entered or computed? → A: Both GPA and academic level MUST be inferred/calculated from the student's past courses and their grades—never manually entered.
- Q: What grading scale should be used for recording course grades? → A: Egyptian university scale: Excellent (3.6–4.0), Very Good (2.8–3.59), Good (2.0–2.79), Pass (1.0–1.99), Fail (0).
- Q: What format should the system-generated University ID follow? → A: Year-sequence format (e.g., `2026-0001`). The system generates this automatically when a student profile is created.
- Q: How are student profiles created? → A: Dual-path: (1) Admin can manually create a student. (2) If a student submits a registration request for the first time, the system auto-creates a profile using the submitted details. On subsequent semesters, the existing profile is reused—no need to re-enter details, major, or level.
- Q: How do students authenticate? → A: Students enter their University ID + National ID as a verification pair. The system checks that both match a stored profile before granting access. No separate password system needed.
- Q: Are registration requests tied to student profiles? → A: Yes. Each request is linked to a student via University ID. Students search by their University ID in the portal to see all their requests across semesters.
- Q: Can admins block students? → A: Yes. Admin can block/unblock a student. A blocked student sees a "blocked" status when they log in and cannot submit new requests.
- Q: When are past courses available during profile creation? → A: Past courses are ONLY available when the Transfer Student toggle is on. New (non-transfer) students start with zero courses—their courses accumulate through the registration request flow over semesters.
- Q: What happens when an admin blocks a student? → A: Read-only access. The student can still log in and view their profile and request history, but sees a "Blocked" banner and cannot submit new registration requests.
- Q: How does a student receive their University ID? → A: Admin creates the student profile with their National ID and either enters a University ID manually or the system generates one. The admin communicates the University ID to the student. The student then uses this ID in the portal to track their requests.
- Q: Does the system need a separate student dashboard? → A: No. The existing student portal is enhanced: students enter their University ID to view their request history, academic status, and submit new requests. No separate login page or dashboard needed—just the existing portal with University ID lookup + lightweight auth.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Creates a New Student Profile (Priority: P1)

An admin opens the Admin Dashboard and navigates to a "Students" section. They fill out a form with the student's basic personal details—name and national ID. A "Transfer Student" toggle is visible but off by default. The admin saves the profile, and the student appears in a searchable student list. Since this is a new student with no academic history, their GPA is 0.0 and academic level is 1.

**Why this priority**: Without the ability to create student profiles, no other feature (transfer handling, course registration, or recommendations) can function. This is the foundational data entry point.

**Independent Test**: Can be fully tested by creating a new student through the admin form with only name and national ID, then verifying the student appears in the student list with GPA shown as 0.0 and level as 1.

**Acceptance Scenarios**:

1. **Given** the admin is on the Students management page, **When** they click "Add Student" and fill in name and national ID, **Then** the student is saved and appears in the student list with GPA 0.0 and academic level 1.
2. **Given** the admin is adding a student, **When** they leave name or national ID empty, **Then** the form shows a validation error and prevents submission.
3. **Given** a student with the same national ID already exists, **When** the admin tries to add another student with that ID, **Then** the system prevents the duplicate and shows an appropriate message.

---

### User Story 2 - Admin Registers Courses and Grades for a Student (Priority: P1)

After creating a student profile, the admin selects the student from the list and registers courses the student has passed along with their grades (using the Egyptian grading scale). The system automatically calculates and updates the student's GPA and academic level based on the registered courses and grades. The passed credit hours are also updated.

**Why this priority**: Course registration with grades is essential for GPA computation and for the recommendation engine to generate accurate graduation roadmaps.

**Independent Test**: Can be fully tested by selecting a student, adding passed courses with grades, and verifying the student's GPA, academic level, and passed hours are correctly calculated.

**Acceptance Scenarios**:

1. **Given** a student profile exists, **When** the admin adds passed courses with grades (e.g., CS101 – Excellent, MATH101 – Good), **Then** the student's GPA is calculated from the weighted average, academic level is inferred from total passed hours, and passedHours updates accordingly.
2. **Given** the admin is registering courses, **When** they enter a course code that does not exist in the course database, **Then** the system shows an error and does not add the invalid course.
3. **Given** the admin adds a course that is already in the student's passed list, **Then** the system prevents the duplicate and informs the admin.
4. **Given** the admin removes a previously passed course, **When** the change is saved, **Then** GPA and academic level are recalculated without that course.

---

### User Story 3 - Admin Adds a Transfer Student (Priority: P2)

When adding a new student, the admin can enable the "Transfer Student" toggle. When enabled, additional fields appear: previous university name, and a section to register the courses the student passed at their previous university along with grades. All transferred courses are treated as equivalent courses recognized by the university—they count toward graduation requirements. The student's GPA and academic level are calculated from these transferred courses.

**Why this priority**: Transfer student handling is a key differentiator for the system. It directly affects how the recommendation engine treats passed courses and ensures academic integrity.

**Independent Test**: Can be fully tested by creating a transfer student, adding their previously completed courses with grades, and verifying the system correctly records their transfer status, calculates GPA, and recognizes the courses toward graduation requirements.

**Acceptance Scenarios**:

1. **Given** the admin is creating a student, **When** they enable the "Transfer Student" toggle, **Then** fields for "Previous University" and a course registration section with grades appear.
2. **Given** a transfer student has been created with previously completed courses and grades, **When** the system saves the profile, **Then** GPA and academic level are automatically calculated from the transferred courses.
3. **Given** a transfer student has been created with previously completed courses, **When** the recommendation engine generates a roadmap, **Then** the transferred courses are treated as passed and the recommendations account for them.

---

### User Story 4 - Admin Views and Edits a Student Profile (Priority: P2)

The admin can click on any student in the list to view their full profile—personal details, academic status (computed GPA and academic level), a summary of completed and remaining courses, and current progress toward graduation. The admin can edit basic profile fields, add/remove courses, and the computed fields update automatically.

**Why this priority**: The ability to view and update student data is essential for ongoing academic advising but depends on the profile and course registration being available first.

**Independent Test**: Can be fully tested by viewing a student's profile page and verifying all details are displayed, then adding a course with a grade and confirming that GPA and level recalculate.

**Acceptance Scenarios**:

1. **Given** a student exists in the system, **When** the admin clicks on the student, **Then** all profile details, passed courses with grades, computed GPA, academic level, and progress summary are displayed.
2. **Given** the admin is viewing a student's profile, **When** they add a new passed course with a grade, **Then** GPA and academic level are recalculated and reflected immediately.
3. **Given** the admin edits a student's major, **When** the change is saved, **Then** the recommendation engine recalculates the roadmap based on the new major.

---

### User Story 5 - Recommendation Plan Based on Student Profile (Priority: P3)

When viewing a student's profile, the admin can generate a personalized graduation roadmap. The roadmap considers the student's major, computed GPA, passed courses, computed academic level, transfer status, and the current term to produce an optimized course plan for the upcoming semester.

**Why this priority**: This is the culmination of all other stories—the recommendation engine already exists but currently requires manual input. This story connects the stored profile data to the recommendation engine for a seamless experience.

**Independent Test**: Can be fully tested by loading a student's profile and generating a roadmap, then comparing the output against manually verified expected results for that student's status.

**Acceptance Scenarios**:

1. **Given** a student has a complete profile with passed courses and grades, **When** the admin clicks "Generate Roadmap," **Then** the system produces a semester plan using the existing roadmap logic with the student's stored data (including computed GPA and level).
2. **Given** a transfer student has courses from another university, **When** a roadmap is generated, **Then** the transferred courses are correctly excluded from recommendations and counted toward progress.
3. **Given** a student's profile data changes (e.g., courses added, major changed), **When** a new roadmap is generated, **Then** the recommendations reflect the updated profile.

---

### Edge Cases

- What happens when a student has no passed courses at all? GPA should be 0.0, academic level should be 1, and the system should generate a first-semester roadmap based on their major.
- How does the system handle a transfer student who has passed courses that do not exist in the university's course database? The system should flag unrecognized courses and allow the admin to manually map them to equivalent university courses or skip them.
- What happens when the admin deletes a student profile? The system should confirm the action and remove all associated data (passed courses, grades, etc.).
- How does the system handle a student changing their major from CS to IT? The recommendation engine should recalculate which courses are mandatory vs. elective under the new major.
- What happens if a course grade is changed after initial registration? GPA and academic level should recalculate automatically.
- How is academic level inferred? Based on total passed credit hours (e.g., Level 1: 0–29 hours, Level 2: 30–59 hours, Level 3: 60–89 hours, Level 4: 90+ hours).
- What happens when a blocked student tries to submit a new request? The system shows a "Blocked" banner on their dashboard and disables the submit request button. The student can still view their profile and past request history in read-only mode.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow admins to create student profiles with basic fields: student name, national ID, and major.
- **FR-002**: System MUST validate all student profile fields—preventing empty required fields (name, national ID) and duplicate national IDs.
- **FR-003**: System MUST allow admins to register passed courses for a transfer student by selecting from the existing course database, along with a grade for each course using the Egyptian grading scale (Excellent, Very Good, Good, Pass, Fail). Past courses are ONLY available for transfer students at creation time.
- **FR-004**: System MUST automatically calculate and update a student's total passed credit hours when courses are added or removed.
- **FR-005**: System MUST automatically calculate GPA from the weighted average of course grades and credit hours. GPA MUST NOT be manually editable.
- **FR-006**: System MUST automatically infer academic level from total passed credit hours (Level 1: 0–29h, Level 2: 30–59h, Level 3: 60–89h, Level 4: 90+h). Academic level MUST NOT be manually editable.
- **FR-007**: System MUST provide a "Transfer Student" toggle on the student creation form that, when enabled, reveals: previous university name field and a course/grade registration section.
- **FR-008**: System MUST treat courses registered for transfer students as equivalent passed courses for graduation requirement calculations.
- **FR-009**: System MUST display a searchable and sortable student list in the Admin Dashboard.
- **FR-010**: System MUST allow admins to view a student's full profile including personal details, courses passed with grades, computed GPA, computed academic level, credit hours completed, and graduation progress.
- **FR-011**: System MUST allow admins to edit student profile fields (name, major) and add/remove courses. Computed fields (GPA, level, hours) MUST recalculate automatically.
- **FR-012**: System MUST allow admins to delete a student profile with a confirmation dialog.
- **FR-013**: System MUST integrate stored student profile data with the existing roadmap generation engine to produce personalized recommendations.
- **FR-014**: System MUST persist student data locally so it survives page refreshes (using browser storage or equivalent client-side persistence).
- **FR-015**: System MUST allow admins to flag unrecognized transferred courses and manually map them to university equivalents.
- **FR-016**: System MUST generate a unique University ID in year-sequence format (e.g., `2026-0001`) when a student profile is created, or allow the admin to enter one manually.
- **FR-017**: System MUST authenticate students by requiring both University ID and National ID; access is granted only when the pair matches a stored profile.
- **FR-018**: System MUST enhance the existing student portal so authenticated students can view their academic status, request history, and submit new registration requests—all within the same portal interface.
- **FR-019**: System MUST link every registration request to a student profile via University ID, preserving request history across semesters.
- **FR-020**: System MUST allow admins to block/unblock students. Blocked students can view their profile and request history (read-only), but see a "Blocked" banner and cannot submit new registration requests.

### Key Entities

- **Student Profile**: Represents a student in the system. Key attributes: name, national ID (unique identifier), university ID (system-generated, format: `YYYY-NNNN`), major (CS/IT/IS/General), transfer status (boolean), previous university (if transfer), blocked status (boolean, default false). Auth: University ID + National ID pair verification (no passwords). Computed attributes: GPA (from grades), academic level (from credit hours), total passed hours. Related to Passed Course Records and Registration Requests.
- **Passed Course Record**: Links a student to courses they have completed. Key attributes: course code, grade (Excellent/Very Good/Good/Pass/Fail), grade points (4.0/3.0/2.0/1.0/0.0), whether it was transferred from another institution, and (for transfer courses) the equivalent university course mapping. Only populated at creation for transfer students.
- **Registration Request** (existing entity, extended): Now linked to a student profile via national ID. Preserves history — one student can have multiple requests across semesters.
- **Course** (existing entity): Already defined in the system. No changes to the entity itself, but it gains new relationships to student profiles.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admins can create a complete student profile in under 2 minutes, including personal details and passed courses with grades.
- **SC-002**: 100% of student profiles persist across page refreshes without data loss.
- **SC-003**: Computed GPA matches expected values based on the Egyptian grading scale for all test cases (accuracy: 100%).
- **SC-004**: Academic level is correctly inferred from total passed credit hours for all test cases.
- **SC-005**: Transfer student course recognition accuracy is 100%—all transferred courses correctly count toward the appropriate graduation requirement buckets.
- **SC-006**: Roadmap recommendations generated from stored profiles match the results of manually entering the same data into the existing portal, ensuring no regression in recommendation quality.
- **SC-007**: The student list supports searching by name or national ID with results appearing in under 1 second.
- **SC-008**: Profile view displays complete student status—personal details, all passed courses with grades, computed GPA, academic level, credit hour progress, and graduation completion percentage—on a single page.

## Assumptions

- Student data is stored client-side (browser localStorage or equivalent) since the current application has no backend server.
- The existing course database and roadmap generation logic remain unchanged; this feature integrates with them rather than replacing them.
- National ID is the unique student identifier for lookups; University ID (system-generated, year-sequence format) serves as both the student's password and display identifier.
- GPA is calculated using: sum(grade_points × credit_hours) / sum(credit_hours) for all passed courses.
- Grade point mapping: Excellent = 4.0, Very Good = 3.0, Good = 2.0, Pass = 1.0, Fail = 0.0.
- Academic level thresholds: Level 1 (0–29h), Level 2 (30–59h), Level 3 (60–89h), Level 4 (90+h).
- The "General" major type (students who haven't selected a specialization) is already supported in the existing data model and continues to work with student profiles.
- Additional student profile fields (phone, email, address, etc.) are deferred to a future iteration pending stakeholder input.
- Student profiles can be created via two paths: (1) admin manually creates one, or (2) system auto-creates on a student's first registration request.
- Past course registration is only available for transfer students at profile creation time. Non-transfer students accumulate courses through the semester registration flow.
- Student authentication uses University ID + National ID pair verification (no passwords needed).
