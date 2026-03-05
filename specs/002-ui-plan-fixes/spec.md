# Feature Specification: UI Fixes and Plan Adjustments

**Feature Branch**: `002-ui-plan-fixes`  
**Created**: 2026-03-06  
**Status**: Draft  
**Input**: User description: "there is an issue across all the system, when I scroll down, the sticky header overlap with other content under it. the admin should be able to delete a course plan from a student . the arabic translation still has an issue, it's not working properly accross all pages and accross all components. the overview should section should be above the tabs, and remove the overview tab and the degree progressbar. for the generate plan, replace the year 1 , year2 ..etc with a number of year input e.g. 2026, 2027 .. etc, the admin can press up or down to increase or decrease the number. in the genreated plan, the name of the course should be visible also."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Resolve Layout Overlaps and Tab Adjustments (Priority: P1)

As a system user, I want the sticky header to not overlap with page content and the overview section to be clearly positioned above the tabs (with the overview tab and degree progress bar removed) so I can navigate the application without visual bugs.

**Why this priority**: Layout issues cause immediate user friction, and the header overlap currently affects all users across the system. 

**Independent Test**: Can be fully tested by scrolling down on any page with a sticky header, and by navigating to a profile/dashboard to verify the overview section placement.

**Acceptance Scenarios**:

1. **Given** a user is on any long page, **When** they scroll down, **Then** the sticky header remains at the top but does not obscure the content immediately underneath it.
2. **Given** a user is viewing a student profile, **When** the page loads, **Then** the overview section is displayed above the tab navigation.
3. **Given** a user is viewing a student profile, **When** they look at the tabs, **Then** the "Overview" tab and the degree progress bar are no longer visible.

---

### User Story 2 - Admin Deletion of Course Plans (Priority: P1)

As an administrator, I want to be able to delete a course plan from a student's profile so I can remove incorrect or outdated plans.

**Why this priority**: Essential for data accuracy and resolving mistakes in student advising.

**Independent Test**: Can be tested by navigating to a student with an existing plan and executing the delete action.

**Acceptance Scenarios**:

1. **Given** an admin is viewing a student with an existing course plan, **When** they initiate the delete action, **Then** the system prompts for confirmation and upon confirmation, removes the plan.
2. **Given** an admin has deleted a plan, **When** the page refreshes, **Then** the plan is no longer visible on the student's profile.

---

### User Story 3 - Comprehensive Arabic Translation Fixes (Priority: P2)

As an Arabic-speaking user, I want all pages and components to accurately and consistently display Arabic translations so I can use the system in my native language without missing context.

**Why this priority**: Important for localized user experience and accessibility.

**Independent Test**: Can be tested by switching the system language to Arabic and navigating through major flows (student portal, admin dashboard).

**Acceptance Scenarios**:

1. **Given** the system is set to Arabic, **When** a user navigates to any page or component, **Then** all text, buttons, and dynamic content are correctly translated and right-to-left (RTL) alignment is maintained.

---

### User Story 4 - Dynamic Year Inputs and Course Names in Plan Generation (Priority: P2)

As an administrator generating a plan, I want to assign specific calendar years (e.g., 2026, 2027) instead of generic "Year 1" labels, and see the full course names in the generated plan, so the output is clearer and more contextually accurate.

**Why this priority**: Improves the clarity and usability of generated academic plans for both admins and students.

**Independent Test**: Can be tested by generating a new plan, verifying the year inputs can be adjusted, and checking the final output for course names.

**Acceptance Scenarios**:

1. **Given** an admin is generating a plan, **When** the year inputs are displayed, **Then** they show specific years (e.g., 2026) instead of "Year X" and include up/down controls to adjust the year.
2. **Given** a plan has been generated, **When** viewing the plan details, **Then** both the course codes and full course names are visible for each entry.

### Edge Cases

- What happens when an admin attempts to delete a plan that is currently locked or in a specific final state?
- How does system handle year inputs that are out of expected bounds (e.g., past years or far future years)?
- What happens if a course name is extremely long; does it break the layout of the generated plan view?
- How does the UI handle Arabic translations for dynamic text that might contain English technical terms?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST ensure the sticky header does not overlap with scrollable page content.
- **FR-002**: System MUST allow users with Admin roles to delete an existing course plan from a student profile.
- **FR-003**: System MUST provide comprehensive and accurate Arabic translations for all UI components and pages.
- **FR-004**: System MUST position the student overview section above the navigation tabs on the student profile view.
- **FR-005**: System MUST remove the "Overview" tab and the degree progress bar from the student profile view.
- **FR-006**: System MUST replace generic "Year X" labels in the plan generation tool with numeric year inputs (e.g., 2026) that can be incremented or decremented via up/down controls.
- **FR-007**: System MUST display the full course name alongside the course code in generated academic plans.

### Key Entities

- **Course Plan**: Represents a generated sequential list of courses for a student. Needs support for deletion and associating specific numeric years to plan blocks.
- **Student Profile**: The UI aggregate displaying student information, tabs, and course plans.
- **Translation Dictionary**: The set of key-value pairs managing localization across the application.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of pages with sticky headers allow full visibility of top content when scrolled to the top.
- **SC-002**: Admins can successfully delete a course plan in under 3 clicks from the student profile.
- **SC-003**: 100% of static UI strings and major dynamic components correctly render in Arabic when the language toggle is switched.
- **SC-004**: Generated plans definitively show 4-digit calendar years and full course names for all entries, with 0 instances of generic "Year X" strings.
