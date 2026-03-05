# Data Model Changes: UI Fixes and Plan Adjustments

## 1. StudentPlan (existing)
Modifies the interaction and semantic usage slightly. The `semester` field will transition from arbitrary strings like "Year 1" to explicit descriptors like "Fall 2026" or "Spring 2027", ensuring chronological correctness.

```typescript
export interface StudentPlan {
    id: string;               // Unique plan ID
    semester: string;         // 'Fall 2026', 'Spring 2027', etc.
    status: 'draft' | 'approved';
    courses: string[];        // Array of course codes (e.g. ['CS101', 'MA102'])
    credits: number;          // Total credits
    generatedAt: string;      // ISO 8601
    approvedAt?: string;      // ISO 8601 when approved
}
```

## 2. Translation Context (extension)
We rely on the existing `LanguageContextType` and `translations` dictionary.
The modifications will predominantly be to the `translations` object inside `LanguageContext.tsx` to ensure all arbitrary UI text is present for Arabic and English. No explicit type changes required.
