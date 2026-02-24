/**
 * Grade Utilities
 * 
 * GPA calculation, academic level inference, and profile-to-roadmap conversion.
 */

import { Student, Course } from '../types';
import { StudentProfile, PassedCourseRecord } from '../types/student';

/**
 * Calculate GPA from passed courses using weighted average.
 * Formula: sum(gradePoints × creditHours) / sum(creditHours)
 * 
 * All courses (including failed) are included in GPA calculation.
 * Returns 0.0 if no courses.
 */
export function calculateGPA(
    passedCourses: PassedCourseRecord[],
    courseLookup: (code: string) => Course | undefined
): number {
    if (passedCourses.length === 0) return 0.0;

    let totalWeightedPoints = 0;
    let totalCredits = 0;

    for (const record of passedCourses) {
        const course = courseLookup(record.courseCode);
        if (!course) continue;

        totalWeightedPoints += record.gradePoints * course.credits;
        totalCredits += course.credits;
    }

    if (totalCredits === 0) return 0.0;
    return Math.round((totalWeightedPoints / totalCredits) * 100) / 100;
}

/**
 * Calculate total passed credit hours (excludes failed courses).
 */
export function calculatePassedHours(
    passedCourses: PassedCourseRecord[],
    courseLookup: (code: string) => Course | undefined
): number {
    let total = 0;
    for (const record of passedCourses) {
        if (record.grade === 'Fail') continue;
        const course = courseLookup(record.courseCode);
        if (course) total += course.credits;
    }
    return total;
}

/**
 * Infer academic level from total passed credit hours.
 * Level 1: 0–29h, Level 2: 30–59h, Level 3: 60–89h, Level 4: 90+h
 */
export function inferAcademicLevel(passedHours: number): 1 | 2 | 3 | 4 {
    if (passedHours >= 90) return 4;
    if (passedHours >= 60) return 3;
    if (passedHours >= 30) return 2;
    return 1;
}

/**
 * Convert a StudentProfile to the Student type expected by roadmapLogic.ts.
 * This bridges stored profiles with the existing recommendation engine.
 */
export function toStudentForRoadmap(
    profile: StudentProfile,
    courseLookup: (code: string) => Course | undefined
): Student {
    const passedHours = calculatePassedHours(profile.passedCourses, courseLookup);
    return {
        major: profile.major,
        gpa: calculateGPA(profile.passedCourses, courseLookup),
        passedCourses: profile.passedCourses
            .filter(r => r.grade !== 'Fail')
            .map(r => r.courseCode),
        passedHours,
    };
}

/**
 * Get the GPA classification label.
 */
export function getGPAClassification(gpa: number): string {
    if (gpa >= 3.6) return 'Excellent';
    if (gpa >= 2.8) return 'Very Good';
    if (gpa >= 2.0) return 'Good';
    if (gpa >= 1.0) return 'Pass';
    return 'Fail';
}
