import { useState, useMemo } from 'react';
import { Course, Major } from '../types';
import { useCourses } from '../context/CourseContext';
import { getCourseRoleInMajor, inferLevelFromCode } from '../data/courses';

interface StudentPlanEditorProps {
    studentId: string;
    studentMajor: Major;
    passedCourses: string[];
    initialSelectedCourses?: string[];
    onSave: (selectedCourses: string[]) => void;
    onCancel: () => void;
}

export function StudentPlanEditor({
    studentId,
    studentMajor,
    passedCourses,
    initialSelectedCourses = [],
    onSave,
    onCancel
}: StudentPlanEditorProps) {
    const { courses } = useCourses();
    const [selectedCourses, setSelectedCourses] = useState<string[]>(initialSelectedCourses);

    // Group courses by level and filter by major relevance
    const coursesByLevel = useMemo(() => {
        const grouped: Record<number, Course[]> = { 1: [], 2: [], 3: [], 4: [] };

        courses.forEach(course => {
            const role = getCourseRoleInMajor(course.code, studentMajor);
            if (role === 'N/A') return; // Skip irrelevant courses
            if (passedCourses.includes(course.code)) return; // Skip passed courses

            const level = course.level || inferLevelFromCode(course.code);
            if (grouped[level]) {
                grouped[level].push(course);
            }
        });

        return grouped;
    }, [courses, studentMajor, passedCourses]);

    // Calculate total credits
    const totalCredits = useMemo(() => {
        return selectedCourses.reduce((sum, code) => {
            const course = courses.find(c => c.code === code);
            return sum + (course?.credits || 0);
        }, 0);
    }, [selectedCourses, courses]);

    const toggleCourse = (code: string) => {
        setSelectedCourses(prev =>
            prev.includes(code)
                ? prev.filter(c => c !== code)
                : [...prev, code]
        );
    };

    const getRoleBadge = (code: string) => {
        const role = getCourseRoleInMajor(code, studentMajor);
        if (role === 'Mandatory') {
            return <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">M</span>;
        }
        return <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">E</span>;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-auto">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-xl font-bold">Edit Student Plan</h2>
                        <p className="text-sm text-gray-500">
                            Student: {studentId} | Major: {studentMajor} |
                            Selected: {selectedCourses.length} courses ({totalCredits} credits)
                        </p>
                    </div>
                    <div className={`text-lg font-bold ${totalCredits > 19 ? 'text-red-600' : 'text-green-600'}`}>
                        {totalCredits}/19 hrs
                    </div>
                </div>

                {/* Course Grid by Level */}
                <div className="space-y-4">
                    {[1, 2, 3, 4].map(level => (
                        <div key={level} className="border rounded-lg p-3">
                            <h3 className="font-semibold text-gray-700 mb-2">Level {level}</h3>
                            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                                {coursesByLevel[level]?.map(course => (
                                    <label
                                        key={course.code}
                                        className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition
                                            ${selectedCourses.includes(course.code)
                                                ? 'bg-blue-50 border-blue-400'
                                                : 'hover:bg-gray-50'
                                            }
                                            ${course.available === false ? 'opacity-50' : ''}
                                        `}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedCourses.includes(course.code)}
                                            onChange={() => toggleCourse(course.code)}
                                            className="w-4 h-4"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1">
                                                <span className="font-mono text-sm">{course.code}</span>
                                                {getRoleBadge(course.code)}
                                            </div>
                                            <div className="text-xs text-gray-500 truncate" title={course.name}>
                                                {course.credits}cr
                                            </div>
                                        </div>
                                    </label>
                                ))}
                                {(!coursesByLevel[level] || coursesByLevel[level].length === 0) && (
                                    <div className="col-span-4 text-gray-400 text-sm">No available courses</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 border rounded-md hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(selectedCourses)}
                        disabled={totalCredits > 19}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                        Save Plan ({selectedCourses.length} courses)
                    </button>
                </div>
            </div>
        </div>
    );
}
