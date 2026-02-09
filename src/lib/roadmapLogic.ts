import { COURSES, getCourseRoleInMajor } from '../data/courses';
import { Student, Course, BucketPriority, Major, Term } from '../types';

// RoleStatus type for internal use
type RoleStatus = "Mandatory" | "Elective" | "N/A";

// Helper: Check if a course is passed
const isPassed = (student: Student, courseCode: string): boolean => {
    return student.passedCourses.includes(courseCode);
};

// Helper: Get role for a major (with dynamic calculation for General students)
// ADAPTER: Uses new majors.ts data structure but returns same format as before
const getRoleForMajor = (course: Course, major: Major): RoleStatus => {
    // For specialized majors, lookup from majors data
    if (major !== 'General') {
        return getCourseRoleInMajor(course.code, major);
    }

    // For General students: dynamically calculate based on all tracks
    // A course is Mandatory for General if it's Mandatory for ALL tracks
    const isMandatoryForAll =
        getCourseRoleInMajor(course.code, 'CS') === 'Mandatory' &&
        getCourseRoleInMajor(course.code, 'IS') === 'Mandatory' &&
        getCourseRoleInMajor(course.code, 'IT') === 'Mandatory';

    if (isMandatoryForAll) {
        return 'Mandatory';
    }

    // A course is Elective for General if it's Elective for ALL tracks
    const isElectiveForAll =
        getCourseRoleInMajor(course.code, 'CS') === 'Elective' &&
        getCourseRoleInMajor(course.code, 'IS') === 'Elective' &&
        getCourseRoleInMajor(course.code, 'IT') === 'Elective';

    if (isElectiveForAll) {
        return 'Elective';
    }

    // Otherwise, it's a specialized course - not available to General
    return 'N/A';
};

// Helper: Check if course is mandatory for ALL majors (College Mandatory)
const isMandatoryForAllMajors = (courseCode: string): boolean => {
    return getCourseRoleInMajor(courseCode, 'CS') === 'Mandatory' &&
        getCourseRoleInMajor(courseCode, 'IS') === 'Mandatory' &&
        getCourseRoleInMajor(courseCode, 'IT') === 'Mandatory';
};

// Helper: Check prerequisites (Recursive-ish, but for now just immediate status)
// Returns { met: boolean, missing: string[] }
const checkPrereqs = (student: Student, course: Course): { met: boolean; missing: string[] } => {
    const missing: string[] = [];
    for (const pCode of course.prereqs) {
        // Handle special prereqs like "HOURS_70"
        if (pCode.startsWith("HOURS_")) {
            const required = parseInt(pCode.split("_")[1]);
            if (student.passedHours < required) missing.push(pCode);
            continue;
        }

        // Standard course prereq
        if (!isPassed(student, pCode)) {
            missing.push(pCode);
        }
    }
    return { met: missing.length === 0, missing };
};

// ========== COURSE SCORING SYSTEM ==========
// Configurable weights for course prioritization
// Adjust these to tune the algorithm for different student levels
const SCORING_WEIGHTS = {
    directDependents: 3,   // Points per direct dependent (immediate unlocks)
    chainDepth: 1,         // Points per course in the full chain (transitive unlocks)
    levelPenalty: -2,      // Penalty per level (lower level = higher score)
    creditBonus: 0.5,      // Bonus per credit hour (prefer higher credit courses)
};

// Helper: Count how many courses directly depend on this course
const getDirectDependentCount = (courseCode: string): number => {
    return COURSES.filter(c =>
        c.prereqs.includes(courseCode)
    ).length;
};

// Cache for chain depth calculations
const chainDepthCache = new Map<string, number>();

// Helper: Calculate total courses unlockable from this course (transitive/recursive)
const getChainDepth = (courseCode: string, visited: Set<string> = new Set()): number => {
    if (visited.has(courseCode)) return 0;
    if (chainDepthCache.has(courseCode)) return chainDepthCache.get(courseCode)!;

    visited.add(courseCode);

    const directDependents = COURSES.filter(c => c.prereqs.includes(courseCode));
    let total = directDependents.length;

    for (const dep of directDependents) {
        total += getChainDepth(dep.code, new Set(visited));
    }

    chainDepthCache.set(courseCode, total);
    return total;
};

// Helper: Infer level from course code (e.g., CS102 -> 1, CS205 -> 2, CS311 -> 3)
const inferLevelFromCode = (code: string): number => {
    const match = code.match(/\d/);
    return match ? parseInt(match[0]) : 9;
};

// Calculate weighted score for a course
const calculateCourseScore = (course: Course): number => {
    const direct = getDirectDependentCount(course.code);
    const chain = getChainDepth(course.code);
    const level = inferLevelFromCode(course.code);

    const score = (
        direct * SCORING_WEIGHTS.directDependents +
        chain * SCORING_WEIGHTS.chainDepth +
        level * SCORING_WEIGHTS.levelPenalty +
        course.credits * SCORING_WEIGHTS.creditBonus
    );

    return score;
};

// ========== END SCORING SYSTEM ==========

// Helper: Get required hours for a bucket/major
// Note: Bucket requirements are defined in BUCKET_DEFS below

const BUCKET_DEFS = [
    { priority: BucketPriority.UniversityMandatory, name: "University Mandatory", required: 10 },
    { priority: BucketPriority.BasicScienceMandatory, name: "Basic Science Mandatory", required: 15 },
    { priority: BucketPriority.BasicScienceElective, name: "Basic Science Elective", required: 6 },
    { priority: BucketPriority.CollegeMandatory, name: "College Mandatory", required: 39 },
    { priority: BucketPriority.CollegeElective, name: "College Elective", required: 6 },
    { priority: BucketPriority.MajorMandatory, name: "Major Mandatory", required: 45 },
    { priority: BucketPriority.MajorElective, name: "Major Elective", required: 12 },
    { priority: BucketPriority.ProjectsTraining, name: "Projects & Training", required: 999 }, // No hard limit, specific courses
];

export interface BucketStatus {
    name: string;
    passed: number;
    planned: number;
    required: number;
}

export const generateRoadmap = (student: Student, currentTerm: Term, coursesInput?: Course[]): { roadmap: Course[], log: string[], bucketStatuses: BucketStatus[] } => {
    const activeCourses = coursesInput ?? COURSES;
    const roadmap: Course[] = [];
    const log: string[] = [];
    let currentLoad = 0;
    const maxLoad = student.gpa < 2.0 ? 12 : 19;

    log.push(`Starting generation for Major: ${student.major}, GPA: ${student.gpa}, Term: ${currentTerm}`);
    log.push(`Max Load: ${maxLoad}`);

    // Build bucket status map
    const bucketStatus = new Map<BucketPriority, { passed: number, required: number, courses: Course[] }>();
    BUCKET_DEFS.forEach(def => {
        bucketStatus.set(def.priority, { passed: 0, required: def.required, courses: [] });
    });

    // Categorize courses into buckets based on student's major
    activeCourses.forEach(c => {
        const role = getRoleForMajor(c, student.major);
        if (role === 'N/A') return; // Skip courses not relevant to student's major

        let priority: BucketPriority | null = null;

        if (c.code.startsWith("UNV")) {
            priority = BucketPriority.UniversityMandatory;
        } else if (c.code.startsWith("BS")) {
            priority = role === 'Mandatory' ? BucketPriority.BasicScienceMandatory : BucketPriority.BasicScienceElective;
        } else if (c.code.startsWith("TR") || c.code.startsWith("PR")) {
            priority = BucketPriority.ProjectsTraining;
        } else {
            // CS, IS, IT courses
            const mandatoryForAll = isMandatoryForAllMajors(c.code);

            if (mandatoryForAll) {
                priority = BucketPriority.CollegeMandatory;
            } else if (role === 'Mandatory') {
                priority = BucketPriority.MajorMandatory;
            } else {
                // Check if this is a college elective (elective for ALL majors)
                const isElectiveForAll =
                    getCourseRoleInMajor(c.code, 'CS') === 'Elective' &&
                    getCourseRoleInMajor(c.code, 'IS') === 'Elective' &&
                    getCourseRoleInMajor(c.code, 'IT') === 'Elective';

                if (isElectiveForAll) {
                    priority = BucketPriority.CollegeElective;
                } else {
                    priority = BucketPriority.MajorElective;
                }
            }
        }

        if (priority) {
            const b = bucketStatus.get(priority);
            if (b) {
                b.courses.push(c);
                if (isPassed(student, c.code)) {
                    b.passed += c.credits;
                }
            }
        }
    });

    // Track planned hours per bucket
    const plannedHours = new Map<BucketPriority, number>();
    BUCKET_DEFS.forEach(def => plannedHours.set(def.priority, 0));

    // Helper: Check if a course can be added
    const canAddCourse = (course: Course): boolean => {
        if (currentLoad + course.credits > maxLoad) return false;
        if (roadmap.find(r => r.code === course.code)) return false;
        if (isPassed(student, course.code)) return false;
        if (course.available === false) return false;
        if (course.term !== currentTerm) return false;
        return checkPrereqs(student, course).met;
    };

    // BUCKET-FIRST ALGORITHM: Process buckets in priority order (1 → 8)
    for (const def of BUCKET_DEFS) {
        const bucket = bucketStatus.get(def.priority)!;
        const isElective = def.name.includes("Elective");

        // Check if bucket is already complete
        if (bucket.passed >= def.required) {
            log.push(`Bucket ${def.name} complete (${bucket.passed}/${def.required})`);
            continue;
        }

        // Get eligible candidates: unpassed, available, this term, prereqs met
        const candidates = bucket.courses
            .filter(c => !isPassed(student, c.code))
            .filter(c => c.available !== false)
            .filter(c => c.term === currentTerm)
            .filter(c => checkPrereqs(student, c).met);

        // LEVEL-FIRST SORTING: Lower levels before higher levels
        candidates.sort((a, b) => {
            const levelA = inferLevelFromCode(a.code);
            const levelB = inferLevelFromCode(b.code);
            if (levelA !== levelB) return levelA - levelB;
            // Tie-breaker: score (for blocking courses)
            return calculateCourseScore(b) - calculateCourseScore(a);
        });

        log.push(`Bucket ${def.name}: ${candidates.length} candidates`);

        // Fill this bucket
        for (const course of candidates) {
            // Stop if we've reached max load
            if (currentLoad >= maxLoad) break;

            // For elective buckets: stop if bucket hours satisfied
            if (isElective) {
                const totalFilled = bucket.passed + (plannedHours.get(def.priority) || 0);
                if (totalFilled >= def.required) break;
            }

            // Check if can add
            if (canAddCourse(course)) {
                roadmap.push(course);
                currentLoad += course.credits;
                plannedHours.set(def.priority, (plannedHours.get(def.priority) || 0) + course.credits);
                log.push(`  Added: ${course.code} (L${inferLevelFromCode(course.code)}, ${course.credits}cr)`);
            }
        }
    }

    // If we still have room, try to add overflow courses from lower-priority buckets
    if (currentLoad < maxLoad) {
        log.push(`--- Overflow fill (${maxLoad - currentLoad} credits remaining) ---`);

        // Collect all remaining eligible courses sorted by level
        const overflowCandidates: Course[] = [];
        for (const def of BUCKET_DEFS) {
            const bucket = bucketStatus.get(def.priority)!;
            const remaining = bucket.courses.filter(c => canAddCourse(c));
            overflowCandidates.push(...remaining);
        }

        // Sort by level, then by score
        overflowCandidates.sort((a, b) => {
            const levelA = inferLevelFromCode(a.code);
            const levelB = inferLevelFromCode(b.code);
            if (levelA !== levelB) return levelA - levelB;
            return calculateCourseScore(b) - calculateCourseScore(a);
        });

        for (const course of overflowCandidates) {
            if (currentLoad >= maxLoad) break;
            if (canAddCourse(course)) {
                roadmap.push(course);
                currentLoad += course.credits;
                log.push(`  Overflow: ${course.code} (L${inferLevelFromCode(course.code)}, ${course.credits}cr)`);
            }
        }
    }

    // Build bucket status summary
    log.push(`--- Bucket Summary ---`);
    const bucketStatuses: BucketStatus[] = [];
    for (const def of BUCKET_DEFS) {
        const info = bucketStatus.get(def.priority)!;
        const planned = plannedHours.get(def.priority) || 0;
        bucketStatuses.push({
            name: def.name,
            passed: info.passed,
            planned: planned,
            required: def.required
        });
        log.push(`${def.name}: ${info.passed}/${def.required} passed, +${planned} planned`);
    }

    log.push(`Total load: ${currentLoad}/${maxLoad} credits`);
    return { roadmap, log, bucketStatuses };
};

// Export helper for UI to get course role
export { getCourseRoleInMajor };
