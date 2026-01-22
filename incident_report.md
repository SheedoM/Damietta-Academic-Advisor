# Incident Report: Multi-Semester Roadmap Algorithm Failure

## 1. Problem Summary
We attempted to introduce a "Multi-Semester" feature to recommend courses for future terms. While doing so, we switched from a **Bucket-Priority Algorithm** (Legacy) to a **Hybrid Sequence/Priority Algorithm** (New).
- **Legacy Algo**: Iterate Buckets (Univ -> Major). Fill available slots.
    - *Pro*: Great for graduation requirements and off-track students (fills gaps).
    - *Con*: Bad for Freshmen (fills schedule with 5 Univ Req courses instead of a balanced mix).
- **New Algo**: Sort by "Ideal Sequence" (Level 1 Fall, Level 1 Spring...). 
    - *Pro*: Great for Freshmen (balanced mix).
    - *Con*: "Too Greedy." It prioritized the "Ideal Path" so aggressively that it sometimes ignored specific Bucket Caps (until patched) or recommended courses that technically fit the "Ideal" timeline but pushed back critical Graduation Requirements for Seniors/Off-Tracking students in edge cases.

## 2. Root Cause Analysis

### Why it failed for Off-Track Students (Level 4)?
The Legacy Algorithm fills "Must-Do" buckets first. A Senior needs to finish specific buckets. The New Algorithm prioritized "Sequence".
- **Scenario**: A Level 4 student needs 3 specific Major Electives. 
- **Failure**: The New Algorithm might see a "Level 1" course that was technically "open" or a lower-priority course with a "lower sequence number" (e.g., a skipped elective from Year 2) and prioritize it over a critical Level 4 Requirement because of the sorting logic, OR it aggressively filled the schedule with "Recommended" courses from the Bylaws that the student didn't strictly *need* if they had alternative credits.

### Why the "Fix" (Credit Caps) broke things?
When we blindly applied strict credit caps to ALL buckets to stop "Grade 1 Overload", we inadvertently stopped Seniors from taking make-up courses if their bucket was "technically full" but with the *wrong* courses (e.g., they had hours but not the specific Mandatory course).
**Key Insight**: You cannot treat "Mandatory" buckets as simple "Credit Hour" buckets. You must check *Specific Course Completion*.

## 3. Proposed Solution: The "Unified Weighted Score" Algorithm
Instead of two conflicting philosophies (Buckets vs Sequence), we need a **Single Weighted Function** that scores every candidate course based on 4 factors:

1.  **Criticality Score**: 
    -   Is this a `Prerequisite` for something else? (High Score)
    -   Is this a `Mandatory` course? (Medium Score)
    -   Is this an `Elective`? (Low Score)
2.  **Timeline Score (The "Freshman Fix")**:
    -   Does this course belong to my *Current Level* or below? (High Score)
    -   Is it from a future level? (Penalty Score).
    -   *Result*: Freshmen don't see Senior courses. Seniors see Freshman courses *if* they failed them.
3.  **Balance Score**:
    -   Penalty for stacking too many of the same "Category" (e.g., if I already selected 2 Univ Reqs, downgrade other Univ Reqs for this term).
4.  **Graduation Closeness (The "Senior Fix")**:
    -   If `CreditsRemaining < 20`, prioritize satisfying specific unmet Buckets over "Ideal Sequence".

### Algorithm Logic (Pseudocode)
```typescript
function scoreCourse(c: Course, student: Student, currentPlan: Course[]): number {
  let score = 0;
  
  // 1. Mandatory vs Elective
  if (isMandatory(c)) score += 100;
  
  // 2. Catch-up (Critical for Off-Track)
  const courseLevel = getLevel(c); 
  const studentLevel = getStudentLevel(student);
  if (courseLevel < studentLevel) score += 50; // Strong push to clear debt
  
  // 3. Balance (Critical for Freshmen)
  const categoryCount = currentPlan.filter(p => p.category === c.category).length;
  if (categoryCount >= 2) score -= 30; // Don't take a 3rd Univ Req
  
  // 4. Prerequisite Power
  score += countFutureDependencies(c) * 10;
  
  return score;
}
```

## 4. Next Steps & Recommendation
For now, we have reverted to the **Main Branch** (Legacy Logic). This is stable implementation, albeit imperfect for Freshmen balance.

**Immediate Action Plan**:
1.  **Leave the Algorithm Alone** for now (as requested).
2.  **Focus on Data/UI**: Implement the "Labelling" feature using the `courses.ts` or `registeration.json` metadata.
3.  **Future**: Implement the "Weighted Score" system in a separate branch with unit tests for *both* Freshman and Senior personas.
