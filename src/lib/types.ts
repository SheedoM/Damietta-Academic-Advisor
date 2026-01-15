export type Term = 1 | 2 | 3;
export type RoleStatus = "Mandatory" | "Elective" | "N/A";
export type Major = "CS" | "IS" | "IT";

export interface Course {
    code: string;
    name: string;
    credits: number;
    prereqs: string[];
    term: Term;
    roles: {
        CS: RoleStatus;
        IS: RoleStatus;
        IT: RoleStatus;
    };
}

export interface Student {
    major: Major;
    gpa: number;
    passedCourses: string[]; // List of Course Codes
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
