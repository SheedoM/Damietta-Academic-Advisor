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
    isTransferred: boolean; // true if from previous university
}

// Full student profile
export interface StudentProfile {
    nationalId: string;       // Unique identifier
    universityId: string;     // System-generated, format: YYYY-NNNN (e.g., 2026-0001)
    name: string;
    major: Major;
    isTransfer: boolean;
    previousUniversity?: string;
    isBlocked: boolean;       // Default: false. Blocked students have read-only portal access.
    passedCourses: PassedCourseRecord[];
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
 * Generate a University ID in YYYY-NNNN format.
 * Scans existing profiles for the highest sequence number in the current year,
 * then increments by 1.
 */
export function generateUniversityId(): string {
    const year = new Date().getFullYear();
    const yearPrefix = `${year}-`;
    const existingIds = getAllStudents()
        .map(p => p.universityId)
        .filter(id => id && id.startsWith(yearPrefix))
        .map(id => parseInt(id.split('-')[1], 10))
        .filter(n => !isNaN(n));
    const nextSeq = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
    return `${year}-${String(nextSeq).padStart(4, '0')}`;
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
