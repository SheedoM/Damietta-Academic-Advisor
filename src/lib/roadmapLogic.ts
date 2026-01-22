import { COURSES } from '../data/courses';
import { Student, Course, Bucket, BucketPriority, Term, Major } from '../types';

export interface LogEntry {
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
}

// Helper: Check if a course is passed
const isPassed = (student: Student, courseCode: string): boolean => {
    return student.passedCourses.includes(courseCode);
};

// Helper: Get course object
const getCourse = (code: string): Course | undefined => {
    return COURSES.find(c => c.code === code);
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

// Helper: Get required hours for a bucket/major
const getBucketRequirements = (bucketName: string, major: Major): number => {
    // Hardcoded rules from prompt
    // In a real app, this should be config-driven
    return 0; // NOT USED directly, we use the priorities. 
    // Wait, the prompt lists specific credit hours. 
    // "Priority 1: University Mandatory Bucket (Must complete 10 Credit Hours)"
    // "Priority 2: Basic Science Mandatory Bucket (Must complete 15 Credit Hours)"
    // ...
    // We need a map of Bucket -> RequiredCredits
};

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

export const generateRoadmap = (student: Student, currentTerm: Term): { roadmap: (Course & { bucket: string })[], log: LogEntry[] } => {
    const roadmap: (Course & { bucket: string })[] = [];
    const log: LogEntry[] = [];
    let currentLoad = 0;
    const maxLoad = student.gpa < 2.0 ? 12 : 18;

    log.push({ type: 'info', message: `Starting generation for Major: ${student.major}, GPA: ${student.gpa}, Term: ${currentTerm}` });
    log.push({ type: 'info', message: `Max Load: ${maxLoad}` });

    // 1. Organize courses into Buckets
    // We need to calculate how many hours the student has ALREADY passed in each bucket
    // to know if we should skip it.

    // Let's build the Bucket Status map
    const bucketStatus = new Map<BucketPriority, { passed: number, required: number, courses: Course[] }>();

    // Fill Status
    BUCKET_DEFS.forEach(def => {
        bucketStatus.set(def.priority, { passed: 0, required: def.required, courses: [] });
    });

    // Categorize ALL courses
    COURSES.forEach(c => {
        const role = c.roles[student.major];
        if (role === 'N/A') return;

        let priority: BucketPriority | null = null;

        // HEURISTIC to map Course to Bucket (Ideally this meta is in the course or a separate config)
        if (c.code.startsWith("UNV")) {
            priority = BucketPriority.UniversityMandatory;
        } else if (c.code.startsWith("BS")) {
            priority = role === 'Mandatory' ? BucketPriority.BasicScienceMandatory : BucketPriority.BasicScienceElective;
        } else if (c.code.startsWith("TR") || c.code.startsWith("PR")) {
            priority = BucketPriority.ProjectsTraining;
        } else {
            // CS, IS, IT
            const isMandatoryForStudent = role === 'Mandatory';
            const isMandatoryForAll = c.roles.CS === 'Mandatory' && c.roles.IS === 'Mandatory' && c.roles.IT === 'Mandatory';

            if (isMandatoryForAll) {
                priority = BucketPriority.CollegeMandatory;
            } else if (isMandatoryForStudent) {
                priority = BucketPriority.MajorMandatory;
            } else {
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

    // 2. Iterate Buckets
    for (const def of BUCKET_DEFS) {
        const bucket = bucketStatus.get(def.priority)!;

        // Check completion
        const isElectiveBucket = def.name.includes("Elective");
        if (isElectiveBucket && bucket.passed >= def.required) {
            log.push({ type: 'info', message: `Skipping ${def.name}: Requirement met (${bucket.passed}/${def.required})` });
            continue;
        }

        log.push({ type: 'info', message: `Processing ${def.name}. Passed: ${bucket.passed}/${def.required}` });

        // Get Candidates: Courses in bucket, not passed
        let candidates = bucket.courses.filter(c => !isPassed(student, c.code));

        // Exception: Training (Term 3)
        if (currentTerm !== 3 && def.priority === BucketPriority.ProjectsTraining) {
            // Special handle: If Project 1 is Term 1, Project 2 is Term 2. match term.
        }

        candidates = candidates.filter(c => c.term === currentTerm);

        if (candidates.length === 0) continue;

        for (const course of candidates) {
            if (currentLoad + course.credits > maxLoad) {
                log.push({ type: 'warning', message: `Skipping ${course.code}: Credits exceed limit.` });
                continue;
            }

            // Check if already added (duplicates across buckets?)
            if (roadmap.find(r => r.code === course.code)) continue;

            const { met, missing } = checkPrereqs(student, course);

            if (met) {
                // Available. Add it.
                // For Electives -> Check if we need more hours.
                if (isElectiveBucket) {
                    const plannedInBucket = roadmap.filter(r => bucket.courses.includes(r)).reduce((sum, c) => sum + c.credits, 0);
                    if (bucket.passed + plannedInBucket >= def.required) continue;
                }

                // Add to roadmap WITH Bucket Name
                roadmap.push({ ...course, bucket: def.name });
                currentLoad += course.credits;
                log.push({ type: 'success', message: `Added ${course.code}` });
            } else {
                // Not met. Try to resolve prereqs?
                log.push({ type: 'warning', message: `Course ${course.code} blocked by ${missing.join(', ')}` });

                // Attempt to find and add missing prereq
                for (const missingCode of missing) {
                    if (missingCode.startsWith("HOURS")) continue; // Can't "add" hours

                    const prereqCourse = getCourse(missingCode);
                    if (!prereqCourse) continue;

                    // Check if prereq is already in roadmap
                    if (roadmap.find(r => r.code === missingCode)) continue;

                    // Check availability of Prereq
                    if (prereqCourse.term === currentTerm) {
                        // Check Prereq's Prereqs
                        const meta = checkPrereqs(student, prereqCourse);
                        if (meta.met) {
                            // Add Prereq!
                            if (currentLoad + prereqCourse.credits <= maxLoad) {
                                roadmap.push({ ...prereqCourse, bucket: "Prerequisite Catch-up" });
                                currentLoad += prereqCourse.credits;
                                log.push({ type: 'success', message: `Added PREREQUISITE ${prereqCourse.code} for ${course.code}` });
                            }
                        }
                    }
                }
            }
        }
    }

    return { roadmap, log };
};
