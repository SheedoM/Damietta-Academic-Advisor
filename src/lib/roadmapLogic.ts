import { COURSES } from '../data/courses';
import { Student, Course, BucketPriority, Term, Major, RoleStatus } from '../types';

// Helper: Check if a course is passed
const isPassed = (student: Student, courseCode: string): boolean => {
    return student.passedCourses.includes(courseCode);
};

// Helper: Get course object
const getCourse = (code: string): Course | undefined => {
    return COURSES.find(c => c.code === code);
};

// Helper: Get role for a major (with dynamic calculation for General students)
const getRoleForMajor = (course: Course, major: Major): RoleStatus => {
    // For specialized majors, just return the role from the course
    if (major !== 'General') {
        return course.roles[major];
    }

    // For General students: dynamically calculate based on all tracks
    // A course is Mandatory for General if it's Mandatory for ALL tracks
    const isMandatoryForAll =
        course.roles.CS === 'Mandatory' &&
        course.roles.IS === 'Mandatory' &&
        course.roles.IT === 'Mandatory';

    if (isMandatoryForAll) {
        return 'Mandatory';
    }

    // A course is Elective for General if it's Elective for ALL tracks
    const isElectiveForAll =
        course.roles.CS === 'Elective' &&
        course.roles.IS === 'Elective' &&
        course.roles.IT === 'Elective';

    if (isElectiveForAll) {
        return 'Elective';
    }

    // Otherwise, it's a specialized course - not available to General
    return 'N/A';
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

export const generateRoadmap = (student: Student, currentTerm: Term): { roadmap: Course[], log: string[], bucketStatuses: BucketStatus[] } => {
    const roadmap: Course[] = [];
    const log: string[] = [];
    let currentLoad = 0;
    const maxLoad = student.gpa < 2.0 ? 12 : 19;

    log.push(`Starting generation for Major: ${student.major}, GPA: ${student.gpa}, Term: ${currentTerm}`);
    log.push(`Max Load: ${maxLoad}`);

    // 1. Organize courses into Buckets
    // We need to calculate how many hours the student has ALREADY passed in each bucket
    // to know if we should skip it.

    // This is tricky because "Passed Hours" isn't just total, it's per bucket.
    // We need to iterate passed courses and attribute them to buckets first?
    // OR, we just check: "Do we have remaining required courses in this bucket?"
    // For Electives, we explicitly check credits.

    // Let's build the Bucket Status map
    const bucketStatus = new Map<BucketPriority, { passed: number, required: number, courses: Course[] }>();

    // Fill Status
    BUCKET_DEFS.forEach(def => {
        bucketStatus.set(def.priority, { passed: 0, required: def.required, courses: [] });
    });

    // Categorize ALL courses
    COURSES.forEach(c => {
        const role = getRoleForMajor(c, student.major);
        if (role === 'N/A') return;

        let priority: BucketPriority | null = null;

        // HEURISTIC to map Course to Bucket (Ideally this meta is in the course or a separate config)
        // Based on Prompt description:
        // P1: UNV...
        // P2: BS... Mandatory
        // P3: BS... Elective
        // P4: College Mandatory (CS, IT, IS all Mandatory, or shared core?)
        // This is vague in the data. "CS101" is "Mandatory" for all. likely College Mandatory.
        // "CS311" is Mandatory for CS, Elective for IT.

        // Let's refine the Mapping logic based on Code prefixes and Roles
        if (c.code.startsWith("UNV")) {
            priority = BucketPriority.UniversityMandatory;
        } else if (c.code.startsWith("BS")) {
            priority = role === 'Mandatory' ? BucketPriority.BasicScienceMandatory : BucketPriority.BasicScienceElective;
        } else if (c.code.startsWith("TR") || c.code.startsWith("PR")) {
            priority = BucketPriority.ProjectsTraining;
        } else {
            // CS, IS, IT
            // If Mandatory for ALL -> College Mandatory? 
            // The prompt says "College Mandatory (Must complete 39 Credit Hours)"
            // "Major Mandatory (Specific to CS...)"
            // We need to differentiate College Mandatory vs Major Mandatory.
            // Heuristic: If it is Mandatory for the student's major...
            // Checking the data: "CS101" is Mandatory for CS, IS, IT. -> College Mandatory.
            // "CS311" is Mandatory for CS only. -> Major Mandatory for CS.

            const isMandatoryForStudent = role === 'Mandatory';
            const isMandatoryForAll = c.roles.CS === 'Mandatory' && c.roles.IS === 'Mandatory' && c.roles.IT === 'Mandatory';

            if (isMandatoryForAll) {
                priority = BucketPriority.CollegeMandatory;
            } else if (isMandatoryForStudent) {
                priority = BucketPriority.MajorMandatory;
            } else {
                // Elective for Student
                // Check if Elective for All? Or just College vs Major Elective?
                // Prompt: "College Elective (6 Hours)", "Major Elective (12 Hours)"
                // This distinction is hard to infer purely from data without a list.
                // BUT, usually "College Elective" is a pool available to all.
                // "Major Elective" might be specific.
                // For now, I will treat ALL Electives as candidates for "Major Elective" or "College Elective" combined 
                // unless I can distinguish.
                // Actually, let's look at "BS211": Elective for All. -> Maybe College Elective?
                // "IT306": IT Mandatory, CS Elective. -> Major Elective for CS?

                // Simplification: Treat all Student-Electives as "General Elective Pool" and fill specific buckets?
                // Or iterate:
                // If Code matches Student Major (e.g. CS student, CS course) -> Major Elective?
                // If Code diff (CS student, IT course) -> College Elective?
                if (c.code.startsWith(student.major)) {
                    priority = BucketPriority.MajorElective;
                } else {
                    priority = BucketPriority.CollegeElective;
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

    // 2. GLOBAL SCORING APPROACH
    // Instead of processing bucket-by-bucket (which causes foundational courses to be skipped),
    // we collect ALL candidates, score them globally, then add while respecting bucket limits.

    // Build a global candidate pool with bucket metadata
    interface ScoredCandidate {
        course: Course;
        bucket: BucketPriority;
        bucketName: string;
        isElective: boolean;
        score: number;
    }

    const allCandidates: ScoredCandidate[] = [];

    for (const def of BUCKET_DEFS) {
        const bucket = bucketStatus.get(def.priority)!;
        const isElective = def.name.includes("Elective");

        // Skip if elective bucket is already complete
        if (isElective && bucket.passed >= def.required) {
            log.push(`Bucket ${def.name} already complete (${bucket.passed}/${def.required})`);
            continue;
        }

        // Get unpassed courses for this term
        const candidates = bucket.courses
            .filter(c => !isPassed(student, c.code))
            .filter(c => c.term === currentTerm);

        // Add to global pool with score
        for (const course of candidates) {
            allCandidates.push({
                course,
                bucket: def.priority,
                bucketName: def.name,
                isElective,
                score: calculateCourseScore(course)
            });
        }
    }

    // Sort ALL candidates by score (highest first)
    allCandidates.sort((a, b) => b.score - a.score);

    // Log top candidates
    const topScores = allCandidates.slice(0, 10).map(c =>
        `${c.course.code}(${c.score.toFixed(1)},${c.bucketName.substring(0, 8)})`
    );
    log.push(`Global candidates (top 10): ${topScores.join(', ')}`);

    // Track planned hours per bucket (separate from passed hours)
    const plannedHours = new Map<BucketPriority, number>();
    BUCKET_DEFS.forEach(def => plannedHours.set(def.priority, 0));

    // Process candidates in score order
    for (const candidate of allCandidates) {
        const { course, bucket, bucketName, isElective } = candidate;

        // Check credit limit
        if (currentLoad + course.credits > maxLoad) {
            continue; // Skip silently, too noisy otherwise
        }

        // Check if already added
        if (roadmap.find(r => r.code === course.code)) continue;

        // For elective buckets: check if we still need hours
        if (isElective) {
            const bucketDef = BUCKET_DEFS.find(d => d.priority === bucket)!;
            const bucketInfo = bucketStatus.get(bucket)!;
            const totalPlanned = plannedHours.get(bucket) || 0;

            if (bucketInfo.passed + totalPlanned >= bucketDef.required) {
                continue; // This bucket is satisfied
            }
        }

        // Check prerequisites
        const { met, missing } = checkPrereqs(student, course);

        if (met) {
            // Add the course!
            roadmap.push(course);
            currentLoad += course.credits;
            plannedHours.set(bucket, (plannedHours.get(bucket) || 0) + course.credits);
            log.push(`Added ${course.code} (${bucketName}, score: ${candidate.score.toFixed(1)})`);
        } else {
            // Try to add missing prereqs if they're available this term
            for (const missingCode of missing) {
                if (missingCode.startsWith("HOURS")) continue;

                const prereqCourse = getCourse(missingCode);
                if (!prereqCourse) continue;
                if (roadmap.find(r => r.code === missingCode)) continue;
                if (prereqCourse.term !== currentTerm) continue;

                const prereqCheck = checkPrereqs(student, prereqCourse);
                if (prereqCheck.met && currentLoad + prereqCourse.credits <= maxLoad) {
                    // Find which bucket the prereq belongs to
                    const prereqCandidate = allCandidates.find(c => c.course.code === missingCode);
                    if (prereqCandidate) {
                        roadmap.push(prereqCourse);
                        currentLoad += prereqCourse.credits;
                        plannedHours.set(prereqCandidate.bucket,
                            (plannedHours.get(prereqCandidate.bucket) || 0) + prereqCourse.credits);
                        log.push(`Added PREREQ ${prereqCourse.code} for ${course.code} (score: ${prereqCandidate.score.toFixed(1)})`);
                    }
                }
            }
        }
    }

    // Log bucket status summary
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
        if (info.passed > 0 || planned > 0) {
            log.push(`${def.name}: ${info.passed} passed + ${planned} planned = ${info.passed + planned}/${def.required}`);
        }
    }

    return { roadmap, log, bucketStatuses };
};

