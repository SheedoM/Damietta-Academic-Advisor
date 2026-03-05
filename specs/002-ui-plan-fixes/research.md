# Research & Technical Context: UI Fixes and Plan Adjustments

## 1. Sticky Header Overlap
**Unknown**: Why does the sticky header overlap with content?
**Decision**: In React/Tailwind, sticky headers at the top of scrollable elements without internal scrolling context or missing padding-top on the container can cause overlaps. I will inspect `StudentPortal.tsx`, `AdminDashboard.tsx`, and `StudentProfileView.tsx` and ensure that the container immediately following the sticky header has proper top margin/padding or the main scroll container is correct.

## 2. Arabic Translation
**Unknown**: Why isn't Arabic translation working properly across all pages?
**Decision**: In `LanguageContext.tsx`, there is a `useLanguage` hook that provides a `t()` function. However, viewing `StudentProfileView.tsx` and other components reveals that text is largely hardcoded in English, completely bypassing the `t()` function. To fix this, we must wrap user-facing strings in `t('key')` and add the missing keys to the `translations` dictionary in `LanguageContext.tsx`. Wait, "still has an issue... not working properly across all pages". This means we should do a systemic sweep of files like `StudentPortal.tsx`, `AdminDashboard.tsx`, `StudentProfileView.tsx`, etc., to introduce `useLanguage()` where missing.

## 3. Plan Generation Inputs
**Unknown**: How is the 'Year 1' logic currently implemented?
**Decision**: In `AdminDashboard.tsx`, bulk plan generation uses a `select` dropdown with hardcoded strings like "Year 1", "Year 2", etc. The spec asks for a number input (e.g., 2026) with up/down arrows. We will replace the string state `bulkPlanTargetYear` with a numeric state defaulting to the current year, and use `<input type="number" />` for it. 
In `StudentProfileView.tsx`, the generated roadmap uses a select with combined values like "Fall 2026", "Spring 2027", etc. We will split this into two controls: a select for the semester (Fall/Spring) and a number input for the year, giving the admin the ability to use up/down arrows for the year.

## 4. Course Names in Generated Plans
**Unknown**: How are course names currently shown (or not shown) in generated plans?
**Decision**: In `StudentProfileView.tsx`, the `plan.courses.map` loop renders pills showing only the course code (e.g., "CS101") and the credit count. We will modify the mapping to also render `course?.name`, with potential truncation if the names are long.

## 5. Overview Layout
**Unknown**: How is the overview tab and degree progress bar rendered?
**Decision**: `StudentProfileView.tsx` contains an explicit Tab Navigation array `['overview', 'courses', 'plans', 'tickets']`. The content for `overview` contains statistics and a degree progress bar. We will uncouple the statistics from the tabs, move them permanently above the tab navigation container, delete the `overview` tab, and delete the degree progress bar altogether.

## 6. Delete Admin Plan
**Unknown**: Where can an admin delete a plan?
**Decision**: In `StudentProfileView.tsx`, underneath the `plans` tab, each plan rendered will have a "Delete" button added alongside the "Edit" and "Approve" buttons. This will remove the selected plan from `currentStudent.plans` and call `updateStudent`.
