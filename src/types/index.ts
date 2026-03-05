export type Term = 1 | 2 | 3;
export type RoleStatus = "Mandatory" | "Elective" | "N/A";
export type MajorId = "CS" | "IS" | "IT";
export type Major = MajorId | "General";
export type CourseLevel = 1 | 2 | 3 | 4;
export type CategoryType = "university" | "basic_science" | "college" | "cs_major" | "it_major" | "is_major";

// Course from JSON database (includes more metadata)
export interface DatabaseCourse {
    course_code: string;
    course_name_en: string;
    course_name_ar: string;
    credit_hours: number;
    requirement_type: "Mandatory" | "Elective";
    level: CourseLevel;
    term: Term;
    // Legacy fields (optional for backwards compatibility)
    lecture_hours?: number;
    practical_hours?: number;
    prerequisite?: string;
}

// Category summary
export interface RequirementsSummary {
    total_credits_required: number;
    mandatory_credits: number;
    elective_credits: number;
}

// Category within database
export interface CourseCategory {
    requirements_summary: RequirementsSummary;
    courses: DatabaseCourse[];
}

// Full database structure
export interface CoursesDatabase {
    university_requirements: CourseCategory;
    basic_science_requirements: CourseCategory;
    college_requirements: CourseCategory;
    cs_major_requirements: CourseCategory;
    it_major_requirements: CourseCategory;
    is_major_requirements: CourseCategory;
}

// Course without embedded roles - roles are defined in majors
export interface Course {
    code: string;
    name: string;
    credits: number;
    prereqs: string[];
    term: Term;
    available?: boolean; // For admin toggle, defaults to true if undefined
    level?: CourseLevel; // Academic level (1-4), inferred from code
    requirementType?: "Mandatory" | "Elective"; // From database
    category?: CategoryType; // Which category this course belongs to
}

// Course entry within a major definition
export interface MajorCourse {
    code: string;
    type: "Mandatory" | "Elective";
}

// Major definition with its courses
export interface MajorDefinition {
    id: MajorId;
    name: string;
    courses: MajorCourse[];
}

export interface Student {
    major: Major;
    gpa: number;
    passedCourses: string[]; // List of Course Codes
    failedCourses: string[]; // List of Failed Course Codes
    passedHours: number; // Could be calculated, but good to have explicit
}

export enum BucketPriority {
    UniversityMandatory = 1,
    BasicScienceMandatory = 2,
    BasicScienceElective = 3,
    CollegeMandatory = 4,
    CollegeElective = 5,
    MajorMandatory = 6,
    MajorElective = 7,
    ProjectsTraining = 8,
}

export interface Bucket {
    priority: BucketPriority;
    name: string;
    requiredHours: number;
    completedHours: number;
    remainingHours: number;
    courses: Course[];
}
