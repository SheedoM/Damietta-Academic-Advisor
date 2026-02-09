/**
 * One-time script to merge level/term from reference.json into courses.json.
 * 
 * Logic:
 * 1. For each course, look up in reference.json by code
 * 2. If reference has numeric level/term -> use it (overwrite if mismatch)
 * 3. If reference has "Variable" -> skip (runtime inference handles it)
 * 4. If course NOT in reference -> infer level from course code (e.g. CS316 -> 3)
 *    and set term based on course code pattern
 * 5. Do NOT change the schema
 */

const fs = require('fs');
const path = require('path');

const COURSES_PATH = path.join(__dirname, '..', 'src', 'data', 'courses.json');
const REFERENCE_PATH = path.join(__dirname, '..', 'src', 'data', 'reference.json');

// Read files
const coursesData = JSON.parse(fs.readFileSync(COURSES_PATH, 'utf-8'));
const referenceData = JSON.parse(fs.readFileSync(REFERENCE_PATH, 'utf-8'));

// Build a lookup from reference.json: code -> { level, term }
const refLookup = new Map();
for (const category of Object.values(referenceData)) {
    if (category && typeof category === 'object' && Array.isArray(category.courses)) {
        for (const course of category.courses) {
            if (course.code) {
                refLookup.set(course.code, {
                    level: course.level,
                    term: course.term
                });
            }
        }
    }
}

console.log(`Reference lookup built: ${refLookup.size} courses`);

// Infer level from course code (e.g., CS316 -> 3, BS101 -> 1, Math0 -> 1)
function inferLevel(code) {
    const match = code.match(/\d/);
    if (match) {
        const digit = parseInt(match[0]);
        if (digit >= 1 && digit <= 4) return digit;
    }
    return 1; // Default
}

let totalCourses = 0;
let updatedFromRef = 0;
let updatedFromInference = 0;
let skippedVariable = 0;
let alreadyMatched = 0;
const changes = [];

// Process each category in courses.json
for (const [catKey, catData] of Object.entries(coursesData)) {
    if (!catData || !Array.isArray(catData.courses)) continue;

    for (const course of catData.courses) {
        totalCourses++;
        const code = course.course_code;
        const ref = refLookup.get(code);

        if (ref) {
            // Source: reference.json
            let courseUpdated = false;

            // Process level
            if (ref.level !== undefined && ref.level !== "Variable") {
                const refLevel = typeof ref.level === 'string' ? parseInt(ref.level) : ref.level;
                if (!isNaN(refLevel)) {
                    if (course.level === undefined || course.level !== refLevel) {
                        changes.push(`${code}: level ${course.level ?? 'MISSING'} -> ${refLevel} (from ref)`);
                        course.level = refLevel;
                        courseUpdated = true;
                    }
                }
            } else if (ref.level === "Variable") {
                skippedVariable++;
            }

            // Process term
            if (ref.term !== undefined && ref.term !== "Variable") {
                const refTerm = typeof ref.term === 'string' ? parseInt(ref.term) : ref.term;
                if (!isNaN(refTerm)) {
                    if (course.term === undefined || course.term !== refTerm) {
                        changes.push(`${code}: term ${course.term ?? 'MISSING'} -> ${refTerm} (from ref)`);
                        course.term = refTerm;
                        courseUpdated = true;
                    }
                }
            }

            if (courseUpdated) {
                updatedFromRef++;
            } else {
                alreadyMatched++;
            }
        } else {
            // Source: inference from course code
            let courseUpdated = false;

            if (course.level === undefined) {
                const inferred = inferLevel(code);
                course.level = inferred;
                changes.push(`${code}: level MISSING -> ${inferred} (inferred)`);
                courseUpdated = true;
            }

            if (course.term === undefined) {
                // Infer term: even course number digit -> term 2, odd -> term 1
                // But more precisely, look at last digit of the numeric part
                const numMatch = code.match(/\d+/);
                if (numMatch) {
                    const lastDigit = parseInt(numMatch[0].slice(-1));
                    // Odd last digit -> term 1, even -> term 2 (common university pattern)
                    const inferred = lastDigit % 2 === 0 ? 2 : 1;
                    course.term = inferred;
                    changes.push(`${code}: term MISSING -> ${inferred} (inferred)`);
                } else {
                    course.term = 1;
                    changes.push(`${code}: term MISSING -> 1 (default)`);
                }
                courseUpdated = true;
            }

            if (courseUpdated) {
                updatedFromInference++;
            } else {
                alreadyMatched++;
            }
        }
    }
}

// Write updated courses.json
fs.writeFileSync(COURSES_PATH, JSON.stringify(coursesData, null, 4), 'utf-8');

console.log('\n=== Merge Summary ===');
console.log(`Total courses in courses.json: ${totalCourses}`);
console.log(`Updated from reference: ${updatedFromRef}`);
console.log(`Updated from inference: ${updatedFromInference}`);
console.log(`Already matched: ${alreadyMatched}`);
console.log(`Skipped (Variable in ref): ${skippedVariable}`);
console.log('\n=== Changes ===');
changes.forEach(c => console.log(`  ${c}`));
console.log('\nDone! courses.json has been updated.');
