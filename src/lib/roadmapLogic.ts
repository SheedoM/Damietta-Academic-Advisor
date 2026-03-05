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

// Helper: Count how many courses directly depend on this course
const getDirectDependentCount = (courseCode: string): number => {
    return COURSES.filter(c => c.prereqs.includes(courseCode)).length;
};

// Helper: Infer level from course code (e.g., CS102 -> 1, CS205 -> 2, CS311 -> 3)
const inferLevelFromCode = (code: string): number => {
    const match = code.match(/\d/);
    return match ? parseInt(match[0]) : 9;
};

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

    // Phase 1: Academic Status Evaluation
    const maxLoad = student.gpa < 2.0 ? 12 : 19;
    let currentLoad = 0;

    log.push(`Starting Generation for Major: ${student.major}, GPA: ${student.gpa}, Term: ${currentTerm}`);
    log.push(`Max Load: ${maxLoad}`);

    // Track passed elective hours for truncation
    let passedCollegeElectives = 0;
    let passedMajorElectives = 0;

    // We still build a basic bucket map for the UI summary since the UI expects bucketStatuses
    const bucketStatus = new Map<BucketPriority, { passed: number, required: number, courses: Course[] }>();
    BUCKET_DEFS.forEach(def => bucketStatus.set(def.priority, { passed: 0, required: def.required, courses: [] }));
    const plannedHours = new Map<BucketPriority, number>();
    BUCKET_DEFS.forEach(def => plannedHours.set(def.priority, 0));

    activeCourses.forEach(c => {
        const role = getRoleForMajor(c, student.major);
        if (role === 'N/A') return;

        // Bucket parsing just for UI
        let priority: BucketPriority | null = null;
        if (c.code.startsWith("UNV")) {
            priority = BucketPriority.UniversityMandatory;
        } else if (c.code.startsWith("BS")) {
            priority = role === 'Mandatory' ? BucketPriority.BasicScienceMandatory : BucketPriority.BasicScienceElective;
        } else if (c.code.startsWith("TR") || c.code.startsWith("PR")) {
            priority = BucketPriority.ProjectsTraining;
        } else {
            const mandatoryForAll = isMandatoryForAllMajors(c.code);
            if (mandatoryForAll) priority = BucketPriority.CollegeMandatory;
            else if (role === 'Mandatory') priority = BucketPriority.MajorMandatory;
            else {
                const isElectiveForAll = getCourseRoleInMajor(c.code, 'CS') === 'Elective' && getCourseRoleInMajor(c.code, 'IS') === 'Elective' && getCourseRoleInMajor(c.code, 'IT') === 'Elective';
                if (isElectiveForAll) priority = BucketPriority.CollegeElective;
                else priority = BucketPriority.MajorElective;
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

        // Elective truncation counting
        if (isPassed(student, c.code)) {
            const isCollegeElective = role === 'Elective' && getCourseRoleInMajor(c.code, 'CS') === 'Elective' && getCourseRoleInMajor(c.code, 'IS') === 'Elective' && getCourseRoleInMajor(c.code, 'IT') === 'Elective';
            if (isCollegeElective) passedCollegeElectives += c.credits;
            else if (role === 'Elective') passedMajorElectives += c.credits;
        }
    });

    const eligibleCourses: (Course & { score: number })[] = [];

    // Phase 2: Course Filtering
    for (const course of activeCourses) {
        if (isPassed(student, course.code)) continue;
        if (course.available === false) continue;
        if (course.term !== currentTerm) continue;

        const role = getRoleForMajor(course, student.major);
        if (role === 'N/A') continue;

        const prereqCheck = checkPrereqs(student, course);
        if (!prereqCheck.met) continue;

        // Phase 2b: Elective Truncation
        const isCollegeElective = role === 'Elective' && getCourseRoleInMajor(course.code, 'CS') === 'Elective' && getCourseRoleInMajor(course.code, 'IS') === 'Elective' && getCourseRoleInMajor(course.code, 'IT') === 'Elective';
        if (isCollegeElective && passedCollegeElectives >= 6) continue;
        if (role === 'Elective' && !isCollegeElective && passedMajorElectives >= 12) continue;

        // Phase 3: Weight Scoring Engine
        let score = 0;

        // Failed Course (+100)
        if (student.failedCourses.includes(course.code)) {
            score += 100;
        }

        // Bottleneck (+50 per dependent)
        const dependants = getDirectDependentCount(course.code);
        score += dependants * 50;

        // Mandatory/Elective (+25/+10)
        if (course.code.startsWith('UNV') || course.code.startsWith('BS')) {
            const mandatoryForAll = isMandatoryForAllMajors(course.code);
            if (mandatoryForAll || role === 'Mandatory') score += 25;
            else score += 10;
        } else if (course.code.startsWith('TR') || course.code.startsWith('PR')) {
            score += 25; // Treat projects/training as Mandatory priority
        } else {
            if (role === 'Mandatory') score += 25;
            else score += 10;
        }

        eligibleCourses.push({ ...course, score });
    }

    // Phase 4: Schedule Generation
    // Sort descending by score. Tie-break: Level ascending (Level 1 before Level 2)
    eligibleCourses.sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        return inferLevelFromCode(a.code) - inferLevelFromCode(b.code);
    });

    const isSummerTrainingRestricted = currentTerm === 3 && student.passedHours >= 70 && !isPassed(student, 'TRN301');

    for (const course of eligibleCourses) {
        if (currentLoad >= maxLoad) break;

        // Summer Training Constraint
        if (isSummerTrainingRestricted) {
            // Can only add projects/training (e.g., TRN301)
            if (!course.code.startsWith('TR') && !course.code.startsWith('PR')) {
                continue;
            }
        }

        if (currentLoad + course.credits <= maxLoad) {
            roadmap.push(course);
            currentLoad += course.credits;
            log.push(`Added: ${course.code} (Score: ${course.score}, L${inferLevelFromCode(course.code)})`);

            // Increment planned hours for UI bucket matching
            const uiPriorityMatches = Array.from(bucketStatus.entries()).find(([_, b]) => b.courses.some(c => c.code === course.code));
            if (uiPriorityMatches) {
                const priority = uiPriorityMatches[0];
                plannedHours.set(priority, (plannedHours.get(priority) || 0) + course.credits);
            }
        }
    }

    // Build bucket status summary for UI
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
    }

    log.push(`Total load: ${currentLoad}/${maxLoad} credits`);
    return { roadmap, log, bucketStatuses };
};

// Export helper for UI to get course role
export { getCourseRoleInMajor };
