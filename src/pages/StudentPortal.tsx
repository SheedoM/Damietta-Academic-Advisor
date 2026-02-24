import { useState, useMemo } from 'react';
import { generateRoadmap } from '../lib/roadmapLogic';
import { Student, Course, Major, Term, CategoryType } from '../types';
import {
    StudentRequest,
    generateTrackingNumber,
    saveRequest,
    getRequestById,
    getRequestsByStudentId
} from '../types/request';
import { useCourses } from '../context/CourseContext';
import { useStudents } from '../context/StudentContext';
import { getCourseByCode, COURSES_DATABASE, getCourseRoleInMajor } from '../data/courses';
import { calculateGPA, calculatePassedHours, inferAcademicLevel, getGPAClassification } from '../lib/gradeUtils';
import { StudentProfile } from '../types/student';


type ViewMode = 'input' | 'courses' | 'plan' | 'ticket' | 'submit' | 'tracking' | 'result' | 'login' | 'dashboard';

// Helper to calculate progress with mandatory/elective breakdown
const calculateCategoryProgress = (category: CategoryType, passedCourses: string[], courses: Course[]) => {
    const categoryKeyMap: Record<CategoryType, string> = {
        'university': 'university_requirements',
        'basic_science': 'basic_science_requirements',
        'college': 'college_requirements',
        'cs_major': 'cs_major_requirements',
        'it_major': 'it_major_requirements',
        'is_major': 'is_major_requirements'
    };

    // @ts-ignore - access safe due to map
    const catData = COURSES_DATABASE[categoryKeyMap[category]];
    if (!catData) return { mandatoryRequired: 0, mandatoryCompleted: 0, electiveRequired: 0, electiveCompleted: 0, totalRequired: 0, totalCompleted: 0 };

    const summary = catData.requirements_summary;
    const mandatoryRequired = summary.mandatory_credits ?? summary.total_credits_required ?? 0;
    const electiveRequired = summary.elective_credits ?? 0;
    const totalRequired = summary.total_credits_required ?? 0;

    let mandatoryCompleted = 0;
    let electiveCompleted = 0;

    // Check directly against the category's course list to handle cross-listed courses
    // (e.g., CS437 is in both cs_major and is_major — getCourseCategory would only return the first match)
    const categoryCourses = catData.courses as { course_code: string; requirement_type: string }[];
    passedCourses.forEach(code => {
        const course = courses.find(c => c.code === code);
        const catCourse = categoryCourses.find(c => c.course_code === code);
        if (course && catCourse) {
            if (catCourse.requirement_type === 'Elective') {
                electiveCompleted += course.credits;
            } else {
                mandatoryCompleted += course.credits;
            }
        }
    });

    return { mandatoryRequired, mandatoryCompleted, electiveRequired, electiveCompleted, totalRequired, totalCompleted: mandatoryCompleted + electiveCompleted };
};


// Category display names
const CATEGORY_NAMES: Record<CategoryType, string> = {
    university: 'University Requirements',
    basic_science: 'Basic Science',
    college: 'College Requirements',
    cs_major: 'CS Major',
    it_major: 'IT Major',
    is_major: 'IS Major'
};

function StudentPortal() {
    const { courses } = useCourses();
    const { getStudentByUniversityId } = useStudents();

    // Auth state for student login
    const [authUniversityId, setAuthUniversityId] = useState('');
    const [authNationalId, setAuthNationalId] = useState('');
    const [authError, setAuthError] = useState('');
    const [authenticatedStudent, setAuthenticatedStudent] = useState<StudentProfile | null>(null);
    const [studentRequests, setStudentRequests] = useState<StudentRequest[]>([]);

    const courseLookupFn = (code: string) => courses.find(c => c.code === code);

    // Student state
    const [student, setStudent] = useState<Student>({
        major: 'CS',
        gpa: 2.0,
        passedCourses: [],
        passedHours: 0,
    });
    const [studentId, setStudentId] = useState('');
    const [studentName, setStudentName] = useState('');
    const [currentTerm, setCurrentTerm] = useState<Term>(1);
    const [jsonInput, setJsonInput] = useState('');
    const [jsonError, setJsonError] = useState('');
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [ticketErrors, setTicketErrors] = useState<Record<string, string>>({});

    // View state
    const [viewMode, setViewMode] = useState<ViewMode>('input');

    // Plan state
    const [recommendedPlan, setRecommendedPlan] = useState<Course[]>([]);

    // Transcript file state
    const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
    const [transcriptError, setTranscriptError] = useState('');

    // Ticket state
    const [ticketSubject, setTicketSubject] = useState('');
    const [ticketMessage, setTicketMessage] = useState('');
    const [includeTicket, setIncludeTicket] = useState(false);

    // Tracking state
    const [trackingId, setTrackingId] = useState('');
    const [submittedRequest, setSubmittedRequest] = useState<StudentRequest | null>(null);
    const [lookupResult, setLookupResult] = useState<StudentRequest | null>(null);

    // Helper: check if a course is in a specific category's course list (handles cross-listed courses)
    const isCourseInCategory = (code: string, categoryKey: string): boolean => {
        // @ts-ignore
        const catData = COURSES_DATABASE[categoryKey];
        if (!catData) return false;
        return catData.courses.some((c: { course_code: string }) => c.course_code === code);
    };

    // Get the student's major category key
    const majorCatKeyMap: Record<string, string> = { CS: 'cs_major_requirements', IT: 'it_major_requirements', IS: 'is_major_requirements' };
    const myMajorCatKey = student.major !== 'General' ? majorCatKeyMap[student.major] : '';

    // Get remaining courses (not passed, available) — filtered by major
    const remainingCourses = useMemo(() => {
        return courses.filter(c => {
            if (c.available === false) return false;
            if (student.passedCourses.includes(c.code)) return false;

            // Always show shared categories
            if (isCourseInCategory(c.code, 'university_requirements')) return true;
            if (isCourseInCategory(c.code, 'basic_science_requirements')) return true;
            if (isCourseInCategory(c.code, 'college_requirements')) return true;

            if (student.major === 'General') {
                // General students: only level 1-2 courses
                return (c.level || 1) <= 2;
            } else {
                // For specialized students: include if course is in their major's course list
                if (myMajorCatKey && isCourseInCategory(c.code, myMajorCatKey)) return true;
                // Exclude courses that are only in other major categories
                return false;
            }
        });
    }, [courses, student.passedCourses, student.major]);

    // Group remaining courses by category (using student's major for cross-listed courses)
    const coursesByCategory = useMemo(() => {
        const grouped: Partial<Record<CategoryType, Course[]>> = {};
        const categoryKeyOrder = ['university_requirements', 'basic_science_requirements', 'college_requirements'];
        const catKeyToType: Record<string, CategoryType> = {
            'university_requirements': 'university',
            'basic_science_requirements': 'basic_science',
            'college_requirements': 'college',
            'cs_major_requirements': 'cs_major',
            'it_major_requirements': 'it_major',
            'is_major_requirements': 'is_major'
        };

        remainingCourses.forEach(course => {
            let assignedCat: CategoryType | null = null;
            // Check shared categories first
            for (const key of categoryKeyOrder) {
                if (isCourseInCategory(course.code, key)) {
                    assignedCat = catKeyToType[key];
                    break;
                }
            }
            // If not shared, assign to student's major category
            if (!assignedCat && myMajorCatKey && isCourseInCategory(course.code, myMajorCatKey)) {
                assignedCat = catKeyToType[myMajorCatKey];
            }
            if (!assignedCat) assignedCat = 'college'; // fallback
            if (!grouped[assignedCat]) grouped[assignedCat] = [];
            grouped[assignedCat]!.push(course);
        });
        return grouped;
    }, [remainingCourses]);

    // Calculate remaining hours until graduation (140 total required)
    const GRADUATION_TOTAL_HOURS = 140;
    const remainingHours = useMemo(() => {
        return Math.max(0, GRADUATION_TOTAL_HOURS - student.passedHours);
    }, [student.passedHours]);

    // Toggle passed course
    const togglePassedCourse = (code: string) => {
        const isPassed = student.passedCourses.includes(code);
        let newPassedCourses: string[];

        if (isPassed) {
            newPassedCourses = student.passedCourses.filter(c => c !== code);
        } else {
            newPassedCourses = [...student.passedCourses, code];
        }

        const hours = newPassedCourses.reduce((sum: number, courseCode: string) => {
            const course = courses.find(c => c.code === courseCode);
            return sum + (course ? course.credits : 0);
        }, 0);

        setStudent({
            ...student,
            passedCourses: newPassedCourses,
            passedHours: hours
        });
    };

    // Validate student form
    const validateStudentForm = (): boolean => {
        const errors: Record<string, string> = {};
        if (!studentId.trim()) errors.studentId = 'Student ID is required';
        else if (!/^\d{6,}$/.test(studentId.trim())) errors.studentId = 'Must be at least 6 digits';
        if (!studentName.trim()) errors.studentName = 'Name is required';
        else if (studentName.trim().length < 3) errors.studentName = 'Minimum 3 characters';
        if (isNaN(student.gpa) || student.gpa < 0 || student.gpa > 4) errors.gpa = 'GPA must be between 0.00 and 4.00';
        if (!transcriptFile) errors.transcript = 'Transcript PDF is required';
        else if (transcriptFile.type !== 'application/pdf') errors.transcript = 'File must be a PDF';
        else if (transcriptFile.size > 10 * 1024 * 1024) errors.transcript = 'File must be under 10 MB';
        setFormErrors(errors);
        setTranscriptError(errors.transcript || '');
        return Object.keys(errors).length === 0;
    };

    // Validate ticket form
    const validateTicketForm = (): boolean => {
        const errors: Record<string, string> = {};
        if (!ticketSubject.trim()) errors.subject = 'Subject is required';
        if (!ticketMessage.trim()) errors.message = 'Message is required';
        else if (ticketMessage.trim().length < 10) errors.message = 'Minimum 10 characters';
        setTicketErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Generate plan
    const handleGeneratePlan = () => {
        const availableCourses = courses.filter(c => c.available !== false);
        const { roadmap } = generateRoadmap(student, currentTerm, availableCourses);
        setRecommendedPlan(roadmap);
        setViewMode('plan');
    };

    // Submit request
    const handleSubmitRequest = async () => {
        // Validate ticket fields if ticket is toggled on
        if (includeTicket && !validateTicketForm()) return;

        // Read transcript file as base64
        let transcriptFileData: string | undefined;
        let transcriptFileName: string | undefined;
        if (transcriptFile) {
            transcriptFileName = transcriptFile.name;
            transcriptFileData = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(transcriptFile);
            });
        }

        const request: StudentRequest = {
            id: generateTrackingNumber(),
            studentId,
            studentName,
            major: student.major,
            passedCourses: student.passedCourses,
            passedHours: student.passedHours,
            recommendedPlan: recommendedPlan.map(c => c.code),
            planCredits: recommendedPlan.reduce((sum, c) => sum + c.credits, 0),
            ticket: includeTicket ? {
                subject: ticketSubject,
                message: ticketMessage
            } : undefined,
            transcriptFileName,
            transcriptFileData,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        saveRequest(request);
        setSubmittedRequest(request);
        setViewMode('result');
    };

    // Track request
    const handleTrackRequest = () => {
        const result = getRequestById(trackingId.trim());
        setLookupResult(result || null);
    };

    // Render based on view mode
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Student Portal</h1>
                <p className="text-gray-600">Academic Advisor Request System</p>
            </header>

            {/* Navigation */}
            <div className="mb-6 flex gap-2 flex-wrap">
                <button
                    onClick={() => setViewMode('input')}
                    className={`px-4 py-2 rounded-lg font-medium transition ${viewMode === 'input' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                >
                    1. Import Details
                </button>
                <button
                    onClick={() => setViewMode('courses')}
                    disabled={!studentId}
                    className={`px-4 py-2 rounded-lg font-medium transition ${viewMode === 'courses' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50'
                        }`}
                >
                    2. View Courses
                </button>
                <button
                    onClick={() => setViewMode('plan')}
                    disabled={recommendedPlan.length === 0}
                    className={`px-4 py-2 rounded-lg font-medium transition ${viewMode === 'plan' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50'
                        }`}
                >
                    3. Review Plan
                </button>
                <button
                    onClick={() => setViewMode('submit')}
                    disabled={recommendedPlan.length === 0}
                    className={`px-4 py-2 rounded-lg font-medium transition ${viewMode === 'submit' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50'
                        }`}
                >
                    4. Submit Request
                </button>
                <div className="flex-1" />
                <button
                    onClick={() => setViewMode('tracking')}
                    className={`px-4 py-2 rounded-lg font-medium transition ${viewMode === 'tracking' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                >
                    Track Request
                </button>
                <button
                    onClick={() => {
                        if (authenticatedStudent) {
                            setStudentRequests(getRequestsByStudentId(authenticatedStudent.universityId));
                            setViewMode('dashboard');
                        } else {
                            setViewMode('login');
                        }
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition ${(viewMode === 'login' || viewMode === 'dashboard') ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                        }`}
                >
                    {authenticatedStudent ? `👤 ${authenticatedStudent.name}` : '🔐 My Account'}
                </button>
            </div>

            {/* Step 1: Import Details */}
            {viewMode === 'input' && (
                <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800">Import Student Details</h2>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Student ID <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={studentId}
                                    onChange={e => { setStudentId(e.target.value); setFormErrors(prev => ({ ...prev, studentId: '' })); }}
                                    className={`w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${formErrors.studentId ? 'border-red-400' : 'border-gray-300'}`}
                                    placeholder="e.g., 2021001234"
                                />
                                {formErrors.studentId && <p className="text-xs text-red-600 mt-1">{formErrors.studentId}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={studentName}
                                    onChange={e => { setStudentName(e.target.value); setFormErrors(prev => ({ ...prev, studentName: '' })); }}
                                    className={`w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${formErrors.studentName ? 'border-red-400' : 'border-gray-300'}`}
                                    placeholder="Your full name"
                                />
                                {formErrors.studentName && <p className="text-xs text-red-600 mt-1">{formErrors.studentName}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Major</label>
                                <select
                                    value={student.major}
                                    onChange={e => setStudent({ ...student, major: e.target.value as Major })}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="General">General Program (Years 1-2)</option>
                                    <option value="CS">Computer Science</option>
                                    <option value="IS">Information Systems</option>
                                    <option value="IT">Information Technology</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">GPA <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="4"
                                    value={student.gpa}
                                    onChange={e => { setStudent({ ...student, gpa: parseFloat(e.target.value) }); setFormErrors(prev => ({ ...prev, gpa: '' })); }}
                                    className={`w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 ${formErrors.gpa ? 'border-red-400' : 'border-gray-300'}`}
                                />
                                {formErrors.gpa && <p className="text-xs text-red-600 mt-1">{formErrors.gpa}</p>}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Current Semester</label>
                            <select
                                value={currentTerm}
                                onChange={e => setCurrentTerm(parseInt(e.target.value) as Term)}
                                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value={1}>Fall (Term 1)</option>
                                <option value={2}>Spring (Term 2)</option>
                                <option value={3}>Summer (Term 3)</option>
                            </select>
                        </div>

                        {/* Transcript PDF Upload */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Transcript PDF <span className="text-red-500">*</span></label>
                            <div className={`border-2 border-dashed rounded-lg p-4 text-center transition ${transcriptFile ? 'border-emerald-300 bg-emerald-50/50' : transcriptError ? 'border-red-300 bg-red-50/30' : 'border-gray-300 hover:border-indigo-300'}`}>
                                {transcriptFile ? (
                                    <div className="flex items-center justify-center gap-3">
                                        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <span className="text-sm text-gray-700 font-medium">{transcriptFile.name}</span>
                                        <span className="text-xs text-gray-400">({(transcriptFile.size / 1024).toFixed(0)} KB)</span>
                                        <button onClick={() => { setTranscriptFile(null); setTranscriptError(''); }} className="text-xs text-red-500 hover:text-red-700 ml-2">Remove</button>
                                    </div>
                                ) : (
                                    <label className="cursor-pointer">
                                        <div className="text-sm text-gray-500">Click to upload or drag & drop</div>
                                        <div className="text-xs text-gray-400 mt-1">PDF only, max 10 MB</div>
                                        <input
                                            type="file"
                                            accept=".pdf,application/pdf"
                                            className="hidden"
                                            onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    if (file.type !== 'application/pdf') {
                                                        setTranscriptError('File must be a PDF');
                                                    } else if (file.size > 10 * 1024 * 1024) {
                                                        setTranscriptError('File must be under 10 MB');
                                                    } else {
                                                        setTranscriptFile(file);
                                                        setTranscriptError('');
                                                    }
                                                }
                                            }}
                                        />
                                    </label>
                                )}
                            </div>
                            {transcriptError && <p className="text-xs text-red-600 mt-1">{transcriptError}</p>}
                        </div>

                        {/* Passed Courses Loading Options */}
                        <div className="border-t pt-4">
                            <div className="flex gap-4 mb-4">
                                <button
                                    className={`text-sm font-medium pb-1 ${!jsonInput ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    onClick={() => setJsonInput('')}
                                >
                                    Select Manually
                                </button>
                                <button
                                    className={`text-sm font-medium pb-1 ${jsonInput ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    onClick={() => setJsonInput('[]')}
                                >
                                    Import JSON
                                </button>
                            </div>

                            {jsonInput !== '' ? (
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">Paste Passed Courses JSON</label>
                                    <textarea
                                        value={jsonInput}
                                        onChange={e => {
                                            setJsonInput(e.target.value);
                                            setJsonError('');
                                        }}
                                        className="w-full h-32 font-mono text-xs border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                                        placeholder='["CS101", "IS201", ...]'
                                    />
                                    {jsonError && <p className="text-xs text-red-600">{jsonError}</p>}
                                    <button
                                        onClick={() => {
                                            try {
                                                const parsed = JSON.parse(jsonInput);
                                                if (!Array.isArray(parsed)) throw new Error("Input must be an array of course codes");

                                                // Validate codes
                                                const validCodes = parsed.filter(c => courses.some(course => course.code === c));

                                                // Toggle all
                                                const newPassed = [...new Set(validCodes)];
                                                const hours = newPassed.reduce((sum: number, courseCode: string) => {
                                                    const course = courses.find(c => c.code === courseCode);
                                                    return sum + (course ? course.credits : 0);
                                                }, 0);

                                                setStudent({
                                                    ...student,
                                                    passedCourses: newPassed as string[],
                                                    passedHours: hours
                                                });
                                                setJsonError(`Successfully imported ${newPassed.length} courses!`);
                                                // Automatically switch to manual view to see selection? No, just show success.
                                            } catch (err) {
                                                setJsonError("Invalid JSON format. Please use [\"CODE1\", \"CODE2\"]");
                                            }
                                        }}
                                        className="text-sm text-indigo-600 font-medium hover:text-indigo-800"
                                    >
                                        Validate & Apply
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Passed Courses ({student.passedCourses.length} selected, {student.passedHours} credit hours)
                                    </label>
                                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                                        {[1, 2, 3, 4].map(level => {
                                            const levelCourses = courses.filter(c => (c.level || 1) === level);
                                            if (levelCourses.length === 0) return null;
                                            return (
                                                <div key={level} className="mb-3">
                                                    <h4 className="text-xs font-semibold text-gray-500 mb-1 sticky top-0 bg-gray-50">Level {level}</h4>
                                                    <div className="grid grid-cols-3 gap-1">
                                                        {levelCourses.map(course => (
                                                            <label key={course.code} className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-white p-1.5 rounded">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={student.passedCourses.includes(course.code)}
                                                                    onChange={() => togglePassedCourse(course.code)}
                                                                    className="w-3.5 h-3.5 text-indigo-600"
                                                                />
                                                                <span className="truncate" title={course.name}>{course.code}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => {
                                if (validateStudentForm()) {
                                    setViewMode('courses');
                                }
                            }}
                            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
                        >
                            Continue to View Courses →
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: View Remaining Courses */}
            {viewMode === 'courses' && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-800">Remaining Courses</h2>
                            <p className="text-sm text-gray-500">{remainingHours} credit hours until graduation</p>
                        </div>
                        <button
                            onClick={handleGeneratePlan}
                            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
                        >
                            Generate Recommended Plan
                        </button>
                    </div>

                    <div className="space-y-8">
                        {(Object.entries(coursesByCategory) as [CategoryType, Course[]][]).map(([category, catCourses]) => {
                            const progress = calculateCategoryProgress(category, student.passedCourses, courses);
                            const mandatoryPct = progress.mandatoryRequired > 0 ? Math.min(100, Math.round((progress.mandatoryCompleted / progress.mandatoryRequired) * 100)) : 100;
                            const electivePct = progress.electiveRequired > 0 ? Math.min(100, Math.round((progress.electiveCompleted / progress.electiveRequired) * 100)) : 100;
                            return (
                                <div key={category}>
                                    {/* Category header */}
                                    <div className="flex items-center justify-between mb-1">
                                        <h3 className="text-base font-semibold text-gray-800">
                                            {student.major !== 'General' && ['cs_major', 'it_major', 'is_major'].includes(category)
                                                ? `${student.major} Major`
                                                : CATEGORY_NAMES[category]}
                                        </h3>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${progress.totalCompleted >= progress.totalRequired ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                                            {progress.totalCompleted} / {progress.totalRequired} Cr
                                        </span>
                                    </div>
                                    {/* Dual progress bars */}
                                    <div className="space-y-1 mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-slate-500 w-[72px] shrink-0">Mandatory</span>
                                            <div className="flex-1 bg-gray-100 rounded-full h-[6px] overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-500 ${mandatoryPct >= 100 ? 'bg-emerald-400' : 'bg-slate-400'}`} style={{ width: `${mandatoryPct}%` }} />
                                            </div>
                                            <span className="text-[11px] text-slate-400 w-12 text-right">{progress.mandatoryCompleted}/{progress.mandatoryRequired}</span>
                                        </div>
                                        {progress.electiveRequired > 0 && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] text-slate-500 w-[72px] shrink-0">Elective</span>
                                                <div className="flex-1 bg-gray-100 rounded-full h-[6px] overflow-hidden">
                                                    <div className={`h-full rounded-full transition-all duration-500 ${electivePct >= 100 ? 'bg-emerald-400' : 'bg-cyan-400'}`} style={{ width: `${electivePct}%` }} />
                                                </div>
                                                <span className="text-[11px] text-slate-400 w-12 text-right">{progress.electiveCompleted}/{progress.electiveRequired}</span>
                                            </div>
                                        )}
                                    </div>
                                    {/* Course cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {catCourses.map(course => {
                                            const role = getCourseRoleInMajor(course.code, student.major !== 'General' ? student.major : 'CS');
                                            const isMandatory = role === 'Mandatory';
                                            return (
                                                <div key={course.code} className={`border border-gray-200 rounded-lg px-3 py-2.5 hover:shadow-sm transition bg-white border-l-2 ${isMandatory ? 'border-l-slate-400' : 'border-l-cyan-300'}`}>
                                                    <div className="flex justify-between items-center mb-0.5">
                                                        <span className="font-medium text-sm text-gray-800">{course.code}</span>
                                                        <span className="text-xs text-gray-400">{course.credits} Cr</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 truncate" title={course.name}>{course.name}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isMandatory ? 'bg-slate-100 text-slate-500' : 'bg-cyan-50 text-cyan-600'}`}>{role}</span>
                                                        <span className="text-[10px] text-gray-300">L{course.level} · T{course.term}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}

                        {/* General students: show Major placeholder after other categories */}
                        {student.major === 'General' && (
                            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                                <h3 className="text-base font-medium text-gray-400 mb-1">Major Requirements</h3>
                                <p className="text-lg font-bold text-gray-300">0 / 57 Cr</p>
                                <p className="text-xs text-gray-400 mt-1">Specialize in CS, IT, or IS to see major-specific courses</p>
                            </div>
                        )}

                        {/* Training & Graduation Project — always visible */}
                        <div className="border border-gray-200 rounded-lg p-4 border-l-2 border-l-violet-300">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-800">Training</h3>
                                    <p className="text-xs text-gray-400">Summer internship / field training</p>
                                </div>
                                <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">0 / 3 Cr</span>
                            </div>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-4 border-l-2 border-l-violet-300">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-800">Graduation Project</h3>
                                    <p className="text-xs text-gray-400">Project 1 (3 Cr) + Project 2 (3 Cr)</p>
                                </div>
                                <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">0 / 6 Cr</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Review Plan */}
            {viewMode === 'plan' && (
                <div className="bg-white rounded-xl shadow-lg p-6 max-w-3xl">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800">Recommended Plan</h2>
                    <div className="mb-4 p-4 bg-indigo-50 rounded-lg">
                        <p className="text-indigo-800">
                            Total: <span className="font-bold">{recommendedPlan.reduce((sum, c) => sum + c.credits, 0)}</span> credit hours •
                            <span className="font-bold"> {recommendedPlan.length}</span> courses
                        </p>
                    </div>

                    {recommendedPlan.length === 0 ? (
                        <p className="text-gray-500 italic">No courses in the plan. Click "Generate Recommended Plan" first.</p>
                    ) : (
                        <ul className="space-y-2 mb-6">
                            {recommendedPlan.map(course => (
                                <li key={course.code} className="flex justify-between items-center border rounded-lg p-3 bg-gray-50">
                                    <div>
                                        <span className="font-medium">{course.code}</span>
                                        <span className="text-gray-600 ml-2">{course.name}</span>
                                    </div>
                                    <span className="font-semibold text-gray-700">{course.credits} Cr</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={() => setViewMode('ticket')}
                            className="flex-1 py-3 border-2 border-orange-500 text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition"
                        >
                            Submit a Ticket
                        </button>
                        <button
                            onClick={() => setViewMode('submit')}
                            className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
                        >
                            Continue to Submit →
                        </button>
                    </div>
                </div>
            )}

            {/* Ticket Form */}
            {viewMode === 'ticket' && (
                <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800">Submit a Ticket</h2>
                    <p className="text-sm text-gray-500 mb-4">Have a question or issue? Describe it below and an admin will respond.</p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Subject <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={ticketSubject}
                                onChange={e => { setTicketSubject(e.target.value); setTicketErrors(prev => ({ ...prev, subject: '' })); }}
                                className={`w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 ${ticketErrors.subject ? 'border-red-400' : 'border-gray-300'}`}
                                placeholder="e.g., Course substitution request"
                            />
                            {ticketErrors.subject && <p className="text-xs text-red-600 mt-1">{ticketErrors.subject}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Message <span className="text-red-500">*</span></label>
                            <textarea
                                value={ticketMessage}
                                onChange={e => { setTicketMessage(e.target.value); setTicketErrors(prev => ({ ...prev, message: '' })); }}
                                rows={5}
                                className={`w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 ${ticketErrors.message ? 'border-red-400' : 'border-gray-300'}`}
                                placeholder="Describe your question or issue (min 10 characters)..."
                            />
                            {ticketErrors.message && <p className="text-xs text-red-600 mt-1">{ticketErrors.message}</p>}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setIncludeTicket(false); setViewMode('submit'); }}
                                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
                            >
                                Skip Ticket
                            </button>
                            <button
                                onClick={() => {
                                    if (validateTicketForm()) {
                                        setIncludeTicket(true);
                                        setViewMode('submit');
                                    }
                                }}
                                className="flex-1 bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 transition"
                            >
                                Include Ticket
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 4: Submit Request */}
            {viewMode === 'submit' && (
                <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800">Review & Submit Request</h2>

                    <div className="space-y-4 mb-6">
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="font-medium text-gray-700 mb-2">Student Information</h3>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div><span className="text-gray-500">ID:</span> {studentId}</div>
                                <div><span className="text-gray-500">Name:</span> {studentName}</div>
                                <div><span className="text-gray-500">Major:</span> {student.major}</div>
                                <div><span className="text-gray-500">GPA:</span> {student.gpa}</div>
                                <div><span className="text-gray-500">Passed Hours:</span> {student.passedHours}</div>
                                {transcriptFile && <div className="col-span-2"><span className="text-gray-500">Transcript:</span> {transcriptFile.name}</div>}
                            </div>
                        </div>

                        <div className="bg-indigo-50 rounded-lg p-4">
                            <h3 className="font-medium text-indigo-700 mb-2">Recommended Plan ({recommendedPlan.length} courses)</h3>
                            <div className="flex flex-wrap gap-2">
                                {recommendedPlan.map(c => (
                                    <span key={c.code} className="px-2 py-1 bg-white rounded text-sm">{c.code}</span>
                                ))}
                            </div>
                            <p className="text-sm text-indigo-600 mt-2">
                                Total: {recommendedPlan.reduce((sum, c) => sum + c.credits, 0)} credit hours
                            </p>
                        </div>

                        {includeTicket && (
                            <div className="bg-orange-50 rounded-lg p-4">
                                <h3 className="font-medium text-orange-700 mb-2">Ticket Attached</h3>
                                <p className="text-sm font-medium">{ticketSubject}</p>
                                <p className="text-sm text-gray-600">{ticketMessage}</p>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleSubmitRequest}
                        className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition text-lg"
                    >
                        Submit Request
                    </button>
                </div>
            )}

            {/* Result: Request Submitted */}
            {viewMode === 'result' && submittedRequest && (
                <div className="bg-white rounded-xl shadow-lg p-6 max-w-lg text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">✓</span>
                    </div>
                    <h2 className="text-2xl font-bold text-green-700 mb-2">Request Submitted!</h2>
                    <p className="text-gray-600 mb-6">Your request has been submitted for review.</p>

                    <div className="bg-gray-100 rounded-lg p-4 mb-6">
                        <p className="text-sm text-gray-500 mb-1">Your Tracking Number</p>
                        <p className="text-2xl font-mono font-bold text-gray-900">{submittedRequest.id}</p>
                        <p className="text-xs text-gray-500 mt-2">Save this number to check your request status</p>
                    </div>

                    <button
                        onClick={() => {
                            setViewMode('input');
                            setRecommendedPlan([]);
                            setSubmittedRequest(null);
                            setStudentId('');
                            setStudentName('');
                            setStudent({ major: 'CS', gpa: 2.0, passedCourses: [], passedHours: 0 });
                        }}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
                    >
                        Submit Another Request
                    </button>
                </div>
            )}

            {/* Track Request */}
            {viewMode === 'tracking' && (
                <div className="bg-white rounded-xl shadow-lg p-6 max-w-xl">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800">Track Your Request</h2>

                    <div className="flex gap-2 mb-6">
                        <input
                            type="text"
                            value={trackingId}
                            onChange={e => setTrackingId(e.target.value)}
                            placeholder="Enter tracking number (e.g., REQ-20260209-ABCD)"
                            className="flex-1 border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-green-500"
                        />
                        <button
                            onClick={handleTrackRequest}
                            className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
                        >
                            Look Up
                        </button>
                    </div>

                    {lookupResult && (
                        <div className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-sm text-gray-500">Tracking #</p>
                                    <p className="font-mono font-medium">{lookupResult.id}</p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${lookupResult.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                    lookupResult.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                        'bg-green-100 text-green-800'
                                    }`}>
                                    {lookupResult.status === 'pending' ? 'Pending' :
                                        lookupResult.status === 'in_progress' ? 'In Progress' : 'Resolved'}
                                </span>
                            </div>

                            <div className="space-y-3 text-sm">
                                <div className="grid grid-cols-2 gap-2">
                                    <div><span className="text-gray-500">Student:</span> {lookupResult.studentName}</div>
                                    <div><span className="text-gray-500">Major:</span> {lookupResult.major}</div>
                                </div>

                                <div>
                                    <span className="text-gray-500">Recommended Plan:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {lookupResult.recommendedPlan.map(code => {
                                            const course = getCourseByCode(code);
                                            return (
                                                <span key={code} className="px-2 py-0.5 bg-gray-100 rounded text-xs" title={course?.name}>
                                                    {code}
                                                </span>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">{lookupResult.planCredits} credit hours</p>
                                </div>

                                {lookupResult.ticket && (
                                    <div className="bg-orange-50 rounded p-3">
                                        <p className="font-medium text-orange-700">{lookupResult.ticket.subject}</p>
                                        <p className="text-gray-600 text-xs">{lookupResult.ticket.message}</p>
                                        {lookupResult.ticket.adminReply && (
                                            <div className="mt-2 pt-2 border-t border-orange-200">
                                                <p className="text-xs text-gray-500">Admin Reply:</p>
                                                <p className="text-gray-700">{lookupResult.ticket.adminReply}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {lookupResult.adminNotes && (
                                    <div className="bg-gray-50 rounded p-3">
                                        <p className="text-xs text-gray-500">Admin Notes:</p>
                                        <p className="text-gray-700">{lookupResult.adminNotes}</p>
                                    </div>
                                )}

                                <p className="text-xs text-gray-400">
                                    Submitted: {new Date(lookupResult.createdAt).toLocaleString()}
                                    {lookupResult.resolvedAt && ` • Resolved: ${new Date(lookupResult.resolvedAt).toLocaleString()}`}
                                </p>
                            </div>
                        </div>
                    )}

                    {trackingId && lookupResult === null && (
                        <p className="text-center text-gray-500 py-8">
                            No request found with that tracking number.
                        </p>
                    )}
                </div>
            )}

            {/* Login View */}
            {viewMode === 'login' && (
                <div className="max-w-md mx-auto">
                    <div className="bg-white rounded-xl shadow-lg p-8">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <span className="text-2xl">🎓</span>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">Student Login</h2>
                            <p className="text-sm text-gray-500 mt-1">Access your academic dashboard and request history</p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">University ID</label>
                                <input
                                    type="text"
                                    value={authUniversityId}
                                    onChange={e => { setAuthUniversityId(e.target.value); setAuthError(''); }}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="e.g., 2026-0001"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">National ID</label>
                                <input
                                    type="text"
                                    value={authNationalId}
                                    onChange={e => { setAuthNationalId(e.target.value); setAuthError(''); }}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="e.g., 29901011234567"
                                />
                            </div>
                            {authError && <p className="text-sm text-red-600">{authError}</p>}
                            <button
                                onClick={() => {
                                    const student = getStudentByUniversityId(authUniversityId.trim());
                                    if (!student) {
                                        setAuthError('No student found with this University ID.');
                                        return;
                                    }
                                    if (student.nationalId !== authNationalId.trim()) {
                                        setAuthError('National ID does not match.');
                                        return;
                                    }
                                    setAuthenticatedStudent(student);
                                    setStudentRequests(getRequestsByStudentId(student.universityId));
                                    setViewMode('dashboard');
                                }}
                                disabled={!authUniversityId.trim() || !authNationalId.trim()}
                                className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50"
                            >
                                Sign In
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dashboard View (authenticated student) */}
            {viewMode === 'dashboard' && authenticatedStudent && (
                <div className="space-y-6 max-w-4xl mx-auto">
                    {/* Blocked banner */}
                    {authenticatedStudent.isBlocked && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                            <span className="text-2xl">🚫</span>
                            <div>
                                <p className="font-semibold text-red-800">Account Blocked</p>
                                <p className="text-sm text-red-600">Your account has been blocked by an administrator. You can view your information but cannot submit new requests.</p>
                            </div>
                        </div>
                    )}

                    {/* Welcome header */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Welcome, {authenticatedStudent.name}</h2>
                                <p className="text-sm text-gray-500">
                                    University ID: <span className="font-mono font-medium text-purple-600">{authenticatedStudent.universityId}</span>
                                    {' • '}Major: {authenticatedStudent.major}
                                    {authenticatedStudent.isTransfer && (
                                        <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                                            Transfer from {authenticatedStudent.previousUniversity}
                                        </span>
                                    )}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setAuthenticatedStudent(null);
                                    setAuthUniversityId('');
                                    setAuthNationalId('');
                                    setViewMode('input');
                                }}
                                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>

                    {/* Academic Summary */}
                    {(() => {
                        const gpa = calculateGPA(authenticatedStudent.passedCourses, courseLookupFn);
                        const passedHours = calculatePassedHours(authenticatedStudent.passedCourses, courseLookupFn);
                        const level = inferAcademicLevel(passedHours);
                        const classification = getGPAClassification(gpa);
                        const totalHoursForGraduation = 144;
                        const progressPercent = Math.min(100, Math.round((passedHours / totalHoursForGraduation) * 100));
                        return (
                            <div className="bg-white rounded-xl shadow-lg p-6">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">Academic Status</h3>
                                <div className="grid grid-cols-4 gap-4 mb-4">
                                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4 text-center">
                                        <p className="text-3xl font-bold text-indigo-700">{gpa.toFixed(2)}</p>
                                        <p className="text-xs text-indigo-500 mt-1">{classification}</p>
                                        <p className="text-xs text-gray-400">GPA</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 text-center">
                                        <p className="text-3xl font-bold text-blue-700">{passedHours}</p>
                                        <p className="text-xs text-blue-500 mt-1">of ~{totalHoursForGraduation}h</p>
                                        <p className="text-xs text-gray-400">Passed Hours</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 text-center">
                                        <p className="text-3xl font-bold text-green-700">{level}</p>
                                        <p className="text-xs text-green-500 mt-1">Year {level}</p>
                                        <p className="text-xs text-gray-400">Academic Level</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 text-center">
                                        <p className="text-3xl font-bold text-purple-700">{authenticatedStudent.passedCourses.length}</p>
                                        <p className="text-xs text-purple-500 mt-1">{authenticatedStudent.passedCourses.filter(c => c.grade !== 'Fail').length} passed</p>
                                        <p className="text-xs text-gray-400">Courses</p>
                                    </div>
                                </div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600 font-medium">Progress to Graduation</span>
                                    <span className="text-gray-500">{progressPercent}%</span>
                                </div>
                                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${progressPercent >= 75 ? 'bg-green-500' : progressPercent >= 50 ? 'bg-blue-500' : 'bg-indigo-500'}`}
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })()}

                    {/* Request History */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Request History</h3>
                        {studentRequests.length > 0 ? (
                            <div className="space-y-3">
                                {studentRequests.map(req => (
                                    <div key={req.id} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className="font-mono text-sm font-medium text-indigo-600">{req.id}</span>
                                                <span className="text-xs text-gray-400 ml-3">{new Date(req.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${req.status === 'resolved' ? 'bg-green-100 text-green-700' :
                                                    req.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-gray-100 text-gray-700'
                                                }`}>
                                                {req.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-600 mt-2">
                                            <span>{req.recommendedPlan.length} courses</span>
                                            <span className="mx-2">•</span>
                                            <span>{req.planCredits} credits</span>
                                            {req.ticket && (
                                                <>
                                                    <span className="mx-2">•</span>
                                                    <span className="text-orange-600">Ticket: {req.ticket.subject}</span>
                                                    {req.ticket.adminReply && (
                                                        <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                                                            <strong>Admin reply:</strong> {req.ticket.adminReply}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        {req.adminNotes && (
                                            <div className="mt-2 text-xs text-gray-500 italic">Notes: {req.adminNotes}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-400">
                                No requests found.
                            </div>
                        )}

                        {!authenticatedStudent.isBlocked && (
                            <div className="mt-4 pt-4 border-t">
                                <button
                                    onClick={() => {
                                        setStudentId(authenticatedStudent.universityId);
                                        setStudentName(authenticatedStudent.name);
                                        setStudent(prev => ({
                                            ...prev,
                                            major: authenticatedStudent.major,
                                            passedCourses: authenticatedStudent.passedCourses
                                                .filter(c => c.grade !== 'Fail')
                                                .map(c => c.courseCode),
                                        }));
                                        setViewMode('courses');
                                    }}
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
                                >
                                    + Submit New Request
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Footer nav */}
            <div className="mt-8 flex justify-center">
                <a href="/admin" className="text-gray-600 hover:text-gray-900 text-sm">
                    Admin Dashboard →
                </a>
            </div>
        </div>
    );
}

export default StudentPortal;
