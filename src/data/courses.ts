/**
 * Courses data module
 * 
 * Re-exports from courseDatabase for backwards compatibility.
 * The actual course data comes from courses.json parsed by courseDatabase.ts
 */

export {
    COURSES,
    COURSES_DATABASE,
    getCourseRoleInMajor,
    getCourseRequirementType,
    getCourseCategory,
    getCoursesForMajor,
    getCourseByCode,
    courseExists,
    inferLevelFromCode,
    MAJORS,
    getMajorIds,
    isCourseInAnyMajor
} from './courseDatabase';
