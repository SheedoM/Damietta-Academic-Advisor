/**
 * Student Profile Types & Storage
 * 
 * Follows the same localStorage pattern as request.ts
 */

import { Major } from './index';

// Egyptian university grading scale
export type Grade = 'Excellent' | 'Very Good' | 'Good' | 'Pass' | 'Fail';

// Grade point mapping
export const GRADE_POINTS: Record<Grade, number> = {
    'Excellent': 4.0,
    'Very Good': 3.0,
    'Good': 2.0,
    'Pass': 1.0,
    'Fail': 0.0,
};

// All available grades for UI dropdowns
export const GRADES: Grade[] = ['Excellent', 'Very Good', 'Good', 'Pass', 'Fail'];

// Record of a course a student has passed (or failed)
export interface PassedCourseRecord {
    courseCode: string;
    grade: Grade;
    gradePoints: number;
    numericGrade?: number;  // actual numeric grade (0-100)
    isTransferred: boolean; // true if from previous university
    isRepeated?: boolean;   // true if course was previously failed and re-taken
}

/**
 * Map a numeric grade (0–100) to the nearest Grade label.
 */
export function numericToGrade(n: number): Grade {
    if (n >= 90) return 'Excellent';
    if (n >= 75) return 'Very Good';
    if (n >= 65) return 'Good';
    if (n >= 50) return 'Pass';
    return 'Fail';
}

/**
 * Convert a 0–100 numeric grade to a 0.0–4.0 grade point for GPA.
 */
export function numericToGradePoints(n: number): number {
    if (n >= 90) return 4.0;
    if (n >= 75) return 3.0;
    if (n >= 65) return 2.0;
    if (n >= 50) return 1.0;
    return 0.0;
}

// Unified Plan Structure for History
export interface StudentPlan {
    id: string;              // Unique identifier (e.g. timestamp/uuid)
    semester: string;        // e.g., "Fall 2026"
    status: 'draft' | 'approved';
    courses: string[];       // Course codes
    credits: number;
    generatedAt: string;     // ISO 8601
    approvedAt?: string;     // ISO 8601 (only if status is approved)
}

// Full student profile
export interface StudentProfile {
    nationalId: string;       // Unique identifier
    universityId: string;     // System-generated, format: YYYYNNNN (e.g., 20260001)
    name: string;
    major: Major;
    isTransfer: boolean;
    previousUniversity?: string;
    isBlocked: boolean;       // Default: false. Blocked students have read-only portal access.
    passedCourses: PassedCourseRecord[];
    profilePicture?: string;  // Base64 data URL for profile photo
    plans?: StudentPlan[];    // History of all generated/approved plans
    createdAt: string;        // ISO 8601
    updatedAt: string;        // ISO 8601
}

// ============ localStorage CRUD ============

const STORAGE_KEY = 'student_profiles';

export function getAllStudents(): StudentProfile[] {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export function getStudentById(nationalId: string): StudentProfile | undefined {
    return getAllStudents().find(s => s.nationalId === nationalId);
}

export function getStudentByUniversityId(universityId: string): StudentProfile | undefined {
    return getAllStudents().find(s => s.universityId === universityId);
}

/**
 * Generate a University ID in YYYYNNNN format.
 * Scans existing profiles for the highest sequence number in the current year,
 * then increments by 1.
 */
export function generateUniversityId(): string {
    const year = new Date().getFullYear();
    const yearStr = String(year);
    const existingIds = getAllStudents()
        .map(p => p.universityId)
        .filter(id => id && id.startsWith(yearStr))
        .map(id => parseInt(id.slice(4), 10))
        .filter(n => !isNaN(n));
    const nextSeq = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
    return `${year}${String(nextSeq).padStart(4, '0')}`;
}

export function saveStudent(student: StudentProfile): void {
    const students = getAllStudents();
    const index = students.findIndex(s => s.nationalId === student.nationalId);
    if (index >= 0) {
        students[index] = { ...student, updatedAt: new Date().toISOString() };
    } else {
        students.push(student);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}

export function deleteStudent(nationalId: string): void {
    const students = getAllStudents().filter(s => s.nationalId !== nationalId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}

export function studentExists(nationalId: string): boolean {
    return getAllStudents().some(s => s.nationalId === nationalId);
}

export function universityIdExists(universityId: string): boolean {
    return getAllStudents().some(s => s.universityId === universityId);
}
