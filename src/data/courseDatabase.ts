/**
 * Course Database Module
 * 
 * Parses the hierarchical courses.json and provides helper functions
 * for accessing course data by category, major, and requirement type.
 */

import coursesJson from './courses.json';
import { Course, DatabaseCourse, CoursesDatabase, MajorId, Major, CategoryType, Term, CourseLevel } from '../types';

// Cast JSON to typed structure
const COURSES_DATABASE = coursesJson as unknown as CoursesDatabase;

// Category keys for iteration
const SHARED_CATEGORIES: (keyof CoursesDatabase)[] = [
    'university_requirements',
    'basic_science_requirements',
    'college_requirements'
];

const MAJOR_CATEGORIES: Record<MajorId, keyof CoursesDatabase> = {
    'CS': 'cs_major_requirements',
    'IT': 'it_major_requirements',
    'IS': 'is_major_requirements'
};

/**
 * Infer academic level from course code
 * e.g., CS101 -> 1, CS205 -> 2, CS311 -> 3, CS401 -> 4
 */
export function inferLevelFromCode(code: string): CourseLevel {
    const match = code.match(/\d/);
    if (match) {
        const firstDigit = parseInt(match[0], 10);
        if (firstDigit >= 1 && firstDigit <= 4) {
            return firstDigit as CourseLevel;
        }
    }
    return 1; // Default to level 1
}

/**
 * Parse prerequisite string to array
 * Handles "-" as no prerequisites, or undefined for new format
 */
function parsePrerequisites(prereqStr?: string): string[] {
    if (!prereqStr || prereqStr === '-') return [];
    return prereqStr.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Infer term from level (simplified heuristic)
 * Level 1,3 = Term 1 (Fall), Level 2,4 = Term 2 (Spring)
 */
function inferTermFromLevel(level: CourseLevel): Term {
    return level % 2 === 1 ? 1 : 2;
}

/**
 * Map category key to CategoryType
 */
function categoryKeyToType(key: keyof CoursesDatabase): CategoryType {
    const mapping: Record<keyof CoursesDatabase, CategoryType> = {
        'university_requirements': 'university',
        'basic_science_requirements': 'basic_science',
        'college_requirements': 'college',
        'cs_major_requirements': 'cs_major',
        'it_major_requirements': 'it_major',
        'is_major_requirements': 'is_major'
    };
    return mapping[key];
}

/**
 * Convert DatabaseCourse to Course with category info
 * Uses level and term directly from JSON when available
 */
function convertToCourse(dbCourse: DatabaseCourse, categoryKey: keyof CoursesDatabase): Course {
    // Use level from JSON, fallback to inference for backwards compatibility
    const level = dbCourse.level ?? inferLevelFromCode(dbCourse.course_code);
    // Use term from JSON, fallback to inference
    const term = dbCourse.term ?? inferTermFromLevel(level);
    return {
        code: dbCourse.course_code,
        name: dbCourse.course_name_en,
        credits: dbCourse.credit_hours,
        prereqs: parsePrerequisites(dbCourse.prerequisite),
        term,
        available: true,
        level,
        requirementType: dbCourse.requirement_type,
        category: categoryKeyToType(categoryKey)
    };
}

/**
 * Build flat COURSES array from all categories
 * Deduplicates courses that appear in multiple major categories
 */
function buildCoursesArray(): Course[] {
    const courseMap = new Map<string, Course>();

    // Add shared courses first (university, basic science, college)
    for (const categoryKey of SHARED_CATEGORIES) {
        const category = COURSES_DATABASE[categoryKey];
        for (const dbCourse of category.courses) {
            if (!courseMap.has(dbCourse.course_code)) {
                courseMap.set(dbCourse.course_code, convertToCourse(dbCourse, categoryKey));
            }
        }
    }

    // Add major-specific courses (use first occurrence's data)
    for (const majorId of Object.keys(MAJOR_CATEGORIES) as MajorId[]) {
        const categoryKey = MAJOR_CATEGORIES[majorId];
        const category = COURSES_DATABASE[categoryKey];
        for (const dbCourse of category.courses) {
            if (!courseMap.has(dbCourse.course_code)) {
                courseMap.set(dbCourse.course_code, convertToCourse(dbCourse, categoryKey));
            }
        }
    }

    return Array.from(courseMap.values());
}

// Export flat COURSES array for backwards compatibility
export const COURSES: Course[] = buildCoursesArray();

// Export database for direct category access
export { COURSES_DATABASE };

/**
 * Get the category a course belongs to (for shared courses)
 */
export function getCourseCategory(code: string): CategoryType | null {
    for (const categoryKey of SHARED_CATEGORIES) {
        const category = COURSES_DATABASE[categoryKey];
        if (category.courses.some(c => c.course_code === code)) {
            return categoryKeyToType(categoryKey);
        }
    }
    // Check major categories
    for (const majorId of Object.keys(MAJOR_CATEGORIES) as MajorId[]) {
        const categoryKey = MAJOR_CATEGORIES[majorId];
        const category = COURSES_DATABASE[categoryKey];
        if (category.courses.some(c => c.course_code === code)) {
            return categoryKeyToType(categoryKey);
        }
    }
    return null;
}

/**
 * Get requirement type for a course within a specific major
 * Checks shared categories first, then major-specific
 */
export function getCourseRequirementType(code: string, major: Major): "Mandatory" | "Elective" | "N/A" {
    // For General major, check if mandatory in any major's shared courses
    if (major === "General") {
        // Check shared categories
        for (const categoryKey of SHARED_CATEGORIES) {
            const category = COURSES_DATABASE[categoryKey];
            const course = category.courses.find(c => c.course_code === code);
            if (course) {
                return course.requirement_type;
            }
        }
        return "N/A";
    }

    // For specific major, check shared first then major-specific
    const majorId = major as MajorId;

    // Check shared categories
    for (const categoryKey of SHARED_CATEGORIES) {
        const category = COURSES_DATABASE[categoryKey];
        const course = category.courses.find(c => c.course_code === code);
        if (course) {
            return course.requirement_type;
        }
    }

    // Check major-specific category
    const majorCategoryKey = MAJOR_CATEGORIES[majorId];
    const majorCategory = COURSES_DATABASE[majorCategoryKey];
    const majorCourse = majorCategory.courses.find(c => c.course_code === code);
    if (majorCourse) {
        return majorCourse.requirement_type;
    }

    return "N/A";
}

/**
 * Alias for backwards compatibility with old majors.ts
 */
export function getCourseRoleInMajor(code: string, majorId: string): "Mandatory" | "Elective" | "N/A" {
    return getCourseRequirementType(code, majorId as Major);
}

/**
 * Get all courses applicable to a specific major
 */
export function getCoursesForMajor(major: MajorId): Course[] {
    const result: Course[] = [];
    const seenCodes = new Set<string>();

    // Add shared courses
    for (const categoryKey of SHARED_CATEGORIES) {
        const category = COURSES_DATABASE[categoryKey];
        for (const dbCourse of category.courses) {
            if (!seenCodes.has(dbCourse.course_code)) {
                seenCodes.add(dbCourse.course_code);
                result.push(convertToCourse(dbCourse, categoryKey));
            }
        }
    }

    // Add major-specific courses
    const majorCategoryKey = MAJOR_CATEGORIES[major];
    const majorCategory = COURSES_DATABASE[majorCategoryKey];
    for (const dbCourse of majorCategory.courses) {
        if (!seenCodes.has(dbCourse.course_code)) {
            seenCodes.add(dbCourse.course_code);
            result.push(convertToCourse(dbCourse, majorCategoryKey));
        }
    }

    return result;
}

/**
 * Check if a course exists in the database
 */
export function courseExists(code: string): boolean {
    return COURSES.some(c => c.code === code);
}

/**
 * Get course by code
 */
export function getCourseByCode(code: string): Course | undefined {
    return COURSES.find(c => c.code === code);
}

// Define major definitions for UI compatibility
export const MAJORS = [
    { id: 'CS' as MajorId, name: 'Computer Science' },
    { id: 'IT' as MajorId, name: 'Information Technology' },
    { id: 'IS' as MajorId, name: 'Information Systems' }
];

/**
 * Helper to get all major IDs
 */
export function getMajorIds(): MajorId[] {
    return ['CS', 'IT', 'IS'];
}

/**
 * Check if course is in any major
 */
export function isCourseInAnyMajor(courseCode: string): boolean {
    return COURSES.some(c => c.code === courseCode);
}
