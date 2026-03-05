/**
 * StudentForm Component
 * 
 * Modal form for creating/editing student profiles.
 * Includes transfer student toggle with conditional fields.
 */

import { useState } from 'react';
import { Major } from '../types';
import { StudentProfile, PassedCourseRecord, generateUniversityId, numericToGrade, numericToGradePoints } from '../types/student';
import { useStudents } from '../context/StudentContext';
import { useCourses } from '../context/CourseContext';
import { MAJORS, getCourseRoleInMajor } from '../data/courses';
import { calculateGPA, calculatePassedHours, inferAcademicLevel } from '../lib/gradeUtils';

interface StudentFormProps {
    existingStudent?: StudentProfile; // If editing
    onClose: () => void;
    onSaved: () => void;
}

export function StudentForm({ existingStudent, onClose, onSaved }: StudentFormProps) {
    const { addStudent, updateStudent } = useStudents();
    const { courses } = useCourses();
    const isEditing = !!existingStudent;

    // Form state
    const [name, setName] = useState(existingStudent?.name || '');
    const [nationalId, setNationalId] = useState(existingStudent?.nationalId || '');
    const [universityId, setUniversityId] = useState(existingStudent?.universityId || '');
    const [customUniversityId, setCustomUniversityId] = useState(false);
    const [major, setMajor] = useState<Major>(existingStudent?.major || 'General');
    const [isTransfer, setIsTransfer] = useState(existingStudent?.isTransfer || false);
    const [previousUniversity, setPreviousUniversity] = useState(existingStudent?.previousUniversity || '');
    const [passedCourses, setPassedCourses] = useState<PassedCourseRecord[]>(existingStudent?.passedCourses || []);

    // Course selection state
    const [courseSearch, setCourseSearch] = useState('');
    const [selectedCourseCode, setSelectedCourseCode] = useState('');
    const [selectedNumericGrade, setSelectedNumericGrade] = useState<number>(65);

    // Errors
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Course lookup helper
    const courseLookup = (code: string) => courses.find(c => c.code === code);

    // Computed values
    const gpa = calculateGPA(passedCourses, courseLookup);
    const passedHours = calculatePassedHours(passedCourses, courseLookup);
    const level = inferAcademicLevel(passedHours);

    // Filter courses for selection (relevant to major, not already added)
    const availableCourses = courses.filter(c => {
        // Don't show already added courses
        if (passedCourses.some(p => p.courseCode === c.code)) return false;
        // Filter by major relevance
        const role = getCourseRoleInMajor(c.code, major);
        if (role === 'N/A') return false;
        // Apply search
        if (courseSearch.trim()) {
            const q = courseSearch.toLowerCase();
            return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
        }
        return true;
    });

    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        if (!name.trim()) errs.name = 'Name is required';
        if (!nationalId.trim()) errs.nationalId = 'National ID is required';
        if (isTransfer && !previousUniversity.trim()) errs.previousUniversity = 'Previous university is required for transfer students';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleAddCourse = () => {
        if (!selectedCourseCode) return;
        if (passedCourses.some(p => p.courseCode === selectedCourseCode)) return;

        const derivedGrade = numericToGrade(selectedNumericGrade);
        const record: PassedCourseRecord = {
            courseCode: selectedCourseCode,
            grade: derivedGrade,
            gradePoints: numericToGradePoints(selectedNumericGrade),
            numericGrade: selectedNumericGrade,
            isTransferred: isTransfer,
        };
        setPassedCourses(prev => [...prev, record]);
        setSelectedCourseCode('');
        setCourseSearch('');
    };

    const handleRemoveCourse = (code: string) => {
        setPassedCourses(prev => prev.filter(p => p.courseCode !== code));
    };

    const handleUpdateGrade = (code: string, numericValue: number) => {
        const derivedGrade = numericToGrade(numericValue);
        setPassedCourses(prev =>
            prev.map(p =>
                p.courseCode === code
                    ? { ...p, grade: derivedGrade, gradePoints: numericToGradePoints(numericValue), numericGrade: numericValue }
                    : p
            )
        );
    };

    const handleSave = () => {
        if (!validate()) return;

        const profile: StudentProfile = {
            nationalId: nationalId.trim(),
            universityId: isEditing
                ? existingStudent!.universityId
                : (customUniversityId && universityId.trim() ? universityId.trim() : generateUniversityId()),
            name: name.trim(),
            major,
            isTransfer,
            isBlocked: existingStudent?.isBlocked || false,
            previousUniversity: isTransfer ? previousUniversity.trim() : undefined,
            passedCourses: isTransfer ? passedCourses : [],
            createdAt: existingStudent?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        if (isEditing) {
            updateStudent(profile);
            onSaved();
        } else {
            const success = addStudent(profile);
            if (!success) {
                setErrors({ nationalId: 'A student with this National ID already exists' });
                return;
            }
            onSaved();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900">
                        {isEditing ? 'Edit Student Profile' : 'Add New Student'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
                </div>

                {/* Basic Info */}
                <div className="space-y-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Full Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className={`w-full border rounded-md px-3 py-2 ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
                                placeholder="e.g., Ahmed Mohamed"
                            />
                            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                National ID <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={nationalId}
                                onChange={e => setNationalId(e.target.value)}
                                disabled={isEditing}
                                className={`w-full border rounded-md px-3 py-2 ${errors.nationalId ? 'border-red-400' : 'border-gray-300'} ${isEditing ? 'bg-gray-100' : ''}`}
                                placeholder="e.g., 29901011234567"
                            />
                            {errors.nationalId && <p className="text-xs text-red-600 mt-1">{errors.nationalId}</p>}
                        </div>
                    </div>

                    {/* University ID */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            University ID
                            {isEditing && <span className="text-gray-400 text-xs ml-1">(read-only)</span>}
                        </label>
                        {isEditing ? (
                            <input
                                type="text"
                                value={existingStudent?.universityId || ''}
                                disabled
                                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-600 font-mono"
                            />
                        ) : (
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs text-gray-500">
                                    <input
                                        type="checkbox"
                                        checked={customUniversityId}
                                        onChange={e => setCustomUniversityId(e.target.checked)}
                                        className="w-3.5 h-3.5"
                                    />
                                    Enter custom University ID
                                </label>
                                {customUniversityId ? (
                                    <input
                                        type="text"
                                        value={universityId}
                                        onChange={e => setUniversityId(e.target.value)}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono"
                                        placeholder="e.g., 20260001"
                                    />
                                ) : (
                                    <p className="text-xs text-gray-400 italic">Will be auto-generated (format: YYYYNNNN)</p>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {isEditing ? (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Major</label>
                                <select
                                    value={major}
                                    onChange={e => setMajor(e.target.value as Major)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                                >
                                    {MAJORS.map(m => (
                                        <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                                    ))}
                                    <option value="General">General Program</option>
                                </select>
                            </div>
                        ) : (
                            <div className="flex items-end">
                                <p className="text-sm text-gray-500 pb-2">Major: <span className="font-medium text-gray-700">General Program</span> <span className="text-xs text-gray-400">(set by student during registration)</span></p>
                            </div>
                        )}
                        <div className="flex items-end">
                            <label className="flex items-center gap-3 cursor-pointer pb-2">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={isTransfer}
                                        onChange={e => setIsTransfer(e.target.checked)}
                                        className="sr-only"
                                    />
                                    <div className={`w-11 h-6 rounded-full transition ${isTransfer ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                                    <div className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition transform ${isTransfer ? 'translate-x-5' : ''}`}></div>
                                </div>
                                <span className="text-sm font-medium text-gray-700">Transfer Student</span>
                            </label>
                        </div>
                    </div>

                    {/* Transfer fields */}
                    {isTransfer && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Previous University <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={previousUniversity}
                                onChange={e => setPreviousUniversity(e.target.value)}
                                className={`w-full border rounded-md px-3 py-2 ${errors.previousUniversity ? 'border-red-400' : 'border-gray-300'}`}
                                placeholder="e.g., Cairo University"
                            />
                            {errors.previousUniversity && <p className="text-xs text-red-600 mt-1">{errors.previousUniversity}</p>}
                        </div>
                    )}
                </div>

                {/* Academic Summary (computed) */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Academic Summary (Computed)</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-2xl font-bold text-indigo-600">{gpa.toFixed(2)}</p>
                            <p className="text-xs text-gray-500">GPA</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-blue-600">{passedHours}</p>
                            <p className="text-xs text-gray-500">Passed Hours</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-green-600">Level {level}</p>
                            <p className="text-xs text-gray-500">Academic Level</p>
                        </div>
                    </div>
                </div>

                {/* Course Registration — only for transfer students */}
                {isTransfer && (
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Passed Courses ({passedCourses.length})</h3>

                        {/* Add course row */}
                        <div className="flex gap-2 mb-3">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={courseSearch}
                                    onChange={e => {
                                        setCourseSearch(e.target.value);
                                        setSelectedCourseCode('');
                                    }}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                    placeholder="Search course code or name..."
                                />
                                {courseSearch && !selectedCourseCode && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                                        {availableCourses.slice(0, 20).map(c => (
                                            <button
                                                key={c.code}
                                                onClick={() => {
                                                    setSelectedCourseCode(c.code);
                                                    setCourseSearch(c.code + ' - ' + c.name);
                                                }}
                                                className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                                            >
                                                <span className="font-mono font-medium">{c.code}</span>
                                                <span className="text-gray-500 ml-2">{c.name}</span>
                                                <span className="text-gray-400 ml-1">({c.credits}cr)</span>
                                            </button>
                                        ))}
                                        {availableCourses.length === 0 && (
                                            <div className="px-3 py-2 text-sm text-gray-400">No matching courses</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 w-44">
                                <input
                                    type="number"
                                    step="1"
                                    min="0"
                                    max="100"
                                    value={selectedNumericGrade}
                                    onChange={e => setSelectedNumericGrade(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                    className="border border-gray-300 rounded-md px-2 py-2 text-sm w-20 text-center"
                                />
                                <span className="text-xs text-gray-400 whitespace-nowrap">{numericToGrade(selectedNumericGrade)}</span>
                            </div>
                            <button
                                onClick={handleAddCourse}
                                disabled={!selectedCourseCode}
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                            >
                                Add
                            </button>
                        </div>

                        {/* Course list */}
                        {passedCourses.length > 0 ? (
                            <div className="border rounded-md overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Credits</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Points</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {passedCourses.map(record => {
                                            const course = courseLookup(record.courseCode);
                                            return (
                                                <tr key={record.courseCode} className="hover:bg-gray-50">
                                                    <td className="px-4 py-2 text-sm font-mono font-medium">
                                                        {record.courseCode}
                                                        {record.isTransferred && (
                                                            <span className="ml-1 text-xs bg-orange-100 text-orange-700 px-1 rounded">T</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-gray-600">{course?.name || 'Unknown'}</td>
                                                    <td className="px-4 py-2 text-sm text-gray-500">{course?.credits || '-'}</td>
                                                    <td className="px-4 py-2 text-sm">
                                                        <div className="flex items-center gap-1.5">
                                                            <input
                                                                type="number"
                                                                step="1"
                                                                min="0"
                                                                max="100"
                                                                value={record.numericGrade ?? record.gradePoints}
                                                                onChange={e => handleUpdateGrade(record.courseCode, Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                                                className="border rounded px-2 py-1 text-sm w-16 text-center"
                                                            />
                                                            <span className="text-xs text-gray-400">{record.grade}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-gray-500">{record.gradePoints.toFixed(1)}</td>
                                                    <td className="px-4 py-2 text-right">
                                                        <button
                                                            onClick={() => handleRemoveCourse(record.courseCode)}
                                                            className="text-red-500 hover:text-red-700 text-sm"
                                                        >
                                                            ✕
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-6 text-gray-400 text-sm border rounded-md">
                                No courses registered yet. Search and add courses above.
                            </div>
                        )}
                    </div>
                )}

                {/* Info for non-transfer */}
                {!isTransfer && (
                    <div className="mb-6 text-center py-4 bg-gray-50 rounded-lg text-sm text-gray-500">
                        New students start with no passed courses. Enable "Transfer Student" to add courses from a previous university.
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border rounded-md hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
                    >
                        {isEditing ? 'Save Changes' : 'Create Student'}
                    </button>
                </div>
            </div>
        </div>
    );
}
