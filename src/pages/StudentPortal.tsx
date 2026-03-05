import { useState, useMemo } from 'react';
import { Course, Major, CategoryType } from '../types';
import {
    Ticket,
    generateTicketNumber,
    saveTicket,
    getTicketsByStudentId,
    getTicketById,
} from '../types/ticket';
import { useCourses } from '../context/CourseContext';
import { useStudents } from '../context/StudentContext';
import { getCourseRoleInMajor, COURSES_DATABASE, MAJORS } from '../data/courses';
import { calculateGPA, calculatePassedHours, inferAcademicLevel, getGPAClassification, toStudentForRoadmap } from '../lib/gradeUtils';
import { StudentProfile, PassedCourseRecord, generateUniversityId, numericToGrade, numericToGradePoints } from '../types/student';


type ViewMode = 'login' | 'register' | 'dashboard' | 'courses' | 'ticket';

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
    const { getStudentByUniversityId, addStudent: addStudentToContext, updateStudent } = useStudents();

    // Auth state
    const [authUniversityId, setAuthUniversityId] = useState('');
    const [authNationalId, setAuthNationalId] = useState('');
    const [authError, setAuthError] = useState('');
    const [authenticatedStudent, setAuthenticatedStudent] = useState<StudentProfile | null>(null);
    const [studentTickets, setStudentTickets] = useState<Ticket[]>([]);

    // Registration state
    const [regName, setRegName] = useState('');
    const [regNationalId, setRegNationalId] = useState('');
    const [regMajor, setRegMajor] = useState<Major>('General');
    const [regIsTransfer, setRegIsTransfer] = useState(false);
    const [regPreviousUniversity, setRegPreviousUniversity] = useState('');
    const [regPassedCourses, setRegPassedCourses] = useState<PassedCourseRecord[]>([]);
    const [regCourseSearch, setRegCourseSearch] = useState('');
    const [regErrors, setRegErrors] = useState<Record<string, string>>({});
    const [regGradeInput, setRegGradeInput] = useState<number>(65);
    const [regProfilePicture, setRegProfilePicture] = useState<string>('');

    // View state
    const [viewMode, setViewMode] = useState<ViewMode>('login');

    // Ticket submission state
    const [ticketSubject, setTicketSubject] = useState('');
    const [ticketMessage, setTicketMessage] = useState('');
    const [ticketFile, setTicketFile] = useState<File | null>(null);
    const [ticketErrors, setTicketErrors] = useState<Record<string, string>>({});
    const [ticketSubmitted, setTicketSubmitted] = useState<Ticket | null>(null);

    // Ticket lookup state
    const [lookupId, setLookupId] = useState('');
    const [lookupResult, setLookupResult] = useState<Ticket | null | undefined>(undefined);

    const courseLookupFn = (code: string) => courses.find(c => c.code === code);

    // Compute remaining courses for the authenticated student
    const passedCodesSet = useMemo(() => {
        if (!authenticatedStudent) return new Set<string>();
        return new Set(authenticatedStudent.passedCourses.filter(c => c.grade !== 'Fail').map(c => c.courseCode));
    }, [authenticatedStudent]);

    const studentMajor = authenticatedStudent?.major || 'General';

    const relevantCategories: CategoryType[] = useMemo(() => {
        const base: CategoryType[] = ['university', 'basic_science', 'college'];
        if (studentMajor === 'CS') base.push('cs_major');
        else if (studentMajor === 'IT') base.push('it_major');
        else if (studentMajor === 'IS') base.push('is_major');
        return base;
    }, [studentMajor]);

    const coursesByCategory = useMemo(() => {
        const result: Partial<Record<CategoryType, Course[]>> = {};
        relevantCategories.forEach(cat => {
            const remaining = courses.filter(c => {
                if (passedCodesSet.has(c.code)) return false;
                if (c.category !== cat) return false;
                return true;
            });
            if (remaining.length > 0) result[cat] = remaining;
        });
        return result;
    }, [courses, passedCodesSet, relevantCategories]);

    const passedCodes = useMemo(() => Array.from(passedCodesSet), [passedCodesSet]);

    const remainingHours = useMemo(() => {
        const totalRequired = 144;
        const passedHrs = passedCodes.reduce((sum, code) => {
            const c = courses.find(x => x.code === code);
            return sum + (c ? c.credits : 0);
        }, 0);
        return Math.max(0, totalRequired - passedHrs);
    }, [passedCodes, courses]);

    // Computed academics
    const computedGPA = authenticatedStudent ? calculateGPA(authenticatedStudent.passedCourses, courseLookupFn) : 0;
    const computedPassedHours = authenticatedStudent ? calculatePassedHours(authenticatedStudent.passedCourses, courseLookupFn) : 0;
    const computedLevel = inferAcademicLevel(computedPassedHours);
    const gpaClass = getGPAClassification(computedGPA);
    const passedCount = authenticatedStudent ? authenticatedStudent.passedCourses.filter(c => c.grade !== 'Fail').length : 0;

    const handleLogin = () => {
        const student = getStudentByUniversityId(authUniversityId.trim());
        if (!student) { setAuthError('No student found with this University ID.'); return; }
        if (student.nationalId !== authNationalId.trim()) { setAuthError('National ID does not match.'); return; }
        setAuthenticatedStudent(student);
        setStudentTickets(getTicketsByStudentId(student.universityId));
        setViewMode('dashboard');
    };

    const handleRegister = () => {
        const errors: Record<string, string> = {};
        if (!regName.trim()) errors.name = 'Name is required';
        if (!regNationalId.trim() || regNationalId.trim().length < 10) errors.nationalId = 'Valid National ID is required';
        if (regIsTransfer && !regPreviousUniversity.trim()) errors.previousUniversity = 'Previous university is required';
        setRegErrors(errors);
        if (Object.keys(errors).length > 0) return;

        const universityId = generateUniversityId();
        const profile: StudentProfile = {
            nationalId: regNationalId.trim(),
            universityId,
            name: regName.trim(),
            major: regMajor,
            isTransfer: regIsTransfer,
            previousUniversity: regIsTransfer ? regPreviousUniversity.trim() : undefined,
            isBlocked: false,
            passedCourses: regPassedCourses,
            profilePicture: regProfilePicture || undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const success = addStudentToContext(profile);
        if (!success) { setRegErrors({ general: 'A student with this National ID already exists. Please login instead.' }); return; }

        setAuthenticatedStudent(profile);
        setStudentTickets([]);
        setViewMode('dashboard');
    };

    const handleSubmitTicket = async () => {
        const errors: Record<string, string> = {};
        if (!ticketSubject.trim()) errors.subject = 'Subject is required';
        if (!ticketMessage.trim()) errors.message = 'Message is required';
        setTicketErrors(errors);
        if (Object.keys(errors).length > 0 || !authenticatedStudent) return;

        let attachmentName: string | undefined;
        let attachmentData: string | undefined;
        if (ticketFile) {
            attachmentName = ticketFile.name;
            attachmentData = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(ticketFile);
            });
        }

        const ticket: Ticket = {
            id: generateTicketNumber(),
            studentId: authenticatedStudent.universityId,
            studentName: authenticatedStudent.name,
            subject: ticketSubject.trim(),
            message: ticketMessage.trim(),
            attachmentName,
            attachmentData,
            status: 'open',
            createdAt: new Date().toISOString(),
        };

        saveTicket(ticket);
        setTicketSubmitted(ticket);
        setStudentTickets(prev => [ticket, ...prev]);
        setTicketSubject('');
        setTicketMessage('');
        setTicketFile(null);
    };

    const handleLookupTicket = () => {
        const result = getTicketById(lookupId.trim());
        setLookupResult(result || null);
    };

    const handleProfilePictureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { setRegErrors(prev => ({ ...prev, pfp: 'Image must be under 2 MB' })); return; }
        const reader = new FileReader();
        reader.onload = () => setRegProfilePicture(reader.result as string);
        reader.readAsDataURL(file);
    };

    // ============ RENDER ============

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Student Portal</h1>
                <p className="text-gray-600">Academic Advisor System</p>
            </header>

            {/* Navigation (only when authenticated) */}
            {authenticatedStudent && (
                <div className="mb-6 flex gap-2 flex-wrap">
                    <button onClick={() => setViewMode('dashboard')}
                        className={`px-4 py-2 rounded-lg font-medium transition ${viewMode === 'dashboard' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
                        📊 Dashboard
                    </button>
                    <button onClick={() => setViewMode('courses')}
                        className={`px-4 py-2 rounded-lg font-medium transition ${viewMode === 'courses' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
                        📚 Courses
                    </button>
                    <button onClick={() => { setTicketSubmitted(null); setViewMode('ticket'); }}
                        className={`px-4 py-2 rounded-lg font-medium transition ${viewMode === 'ticket' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
                        🎫 Submit Ticket
                    </button>
                    <div className="flex-1" />
                    <div className="flex items-center gap-3">
                        {authenticatedStudent.profilePicture && (
                            <img src={authenticatedStudent.profilePicture} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-purple-200" />
                        )}
                        <span className="text-sm font-medium text-gray-700">{authenticatedStudent.name}</span>
                        <button onClick={() => { setAuthenticatedStudent(null); setViewMode('login'); }}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                            Sign Out
                        </button>
                    </div>
                </div>
            )}

            {/* ============ LOGIN ============ */}
            {viewMode === 'login' && (
                <div className="max-w-md mx-auto">
                    <div className="bg-white rounded-xl shadow-lg p-8">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <span className="text-2xl">🎓</span>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">Student Login</h2>
                            <p className="text-sm text-gray-500 mt-1">Access your academic dashboard</p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">University ID</label>
                                <input type="text" value={authUniversityId}
                                    onChange={e => { setAuthUniversityId(e.target.value); setAuthError(''); }}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="e.g., 20260001" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">National ID</label>
                                <input type="text" value={authNationalId}
                                    onChange={e => { setAuthNationalId(e.target.value); setAuthError(''); }}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="e.g., 29901011234567" />
                            </div>
                            {authError && <p className="text-sm text-red-600">{authError}</p>}
                            <button onClick={handleLogin}
                                disabled={!authUniversityId.trim() || !authNationalId.trim()}
                                className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50">
                                Sign In
                            </button>
                            <div className="text-center pt-2 border-t">
                                <p className="text-sm text-gray-500">
                                    Don't have an account?{' '}
                                    <button onClick={() => setViewMode('register')} className="text-purple-600 font-semibold hover:text-purple-700">Register</button>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ REGISTER ============ */}
            {viewMode === 'register' && (
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white rounded-xl shadow-lg p-8">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <span className="text-2xl">📝</span>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">Student Registration</h2>
                            <p className="text-sm text-gray-500 mt-1">Create your academic profile</p>
                        </div>

                        <div className="space-y-4">
                            {/* Profile Picture */}
                            <div className="flex justify-center">
                                <div className="text-center">
                                    <div className="relative w-24 h-24 mx-auto mb-2">
                                        {regProfilePicture ? (
                                            <img src={regProfilePicture} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-green-200" />
                                        ) : (
                                            <div className="w-24 h-24 rounded-full bg-gray-100 border-4 border-dashed border-gray-300 flex items-center justify-center">
                                                <span className="text-3xl text-gray-300">👤</span>
                                            </div>
                                        )}
                                    </div>
                                    <label className="cursor-pointer text-sm text-green-600 hover:text-green-700 font-medium">
                                        {regProfilePicture ? 'Change Photo' : 'Upload Photo (optional)'}
                                        <input type="file" accept="image/*" className="hidden" onChange={handleProfilePictureUpload} />
                                    </label>
                                    {regErrors.pfp && <p className="text-xs text-red-600 mt-1">{regErrors.pfp}</p>}
                                </div>
                            </div>

                            {/* Name & National ID */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                                    <input type="text" value={regName}
                                        onChange={e => { setRegName(e.target.value); setRegErrors(prev => ({ ...prev, name: '' })); }}
                                        className={`w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500 ${regErrors.name ? 'border-red-400' : 'border-gray-300'}`}
                                        placeholder="e.g., Ahmed Mohamed" />
                                    {regErrors.name && <p className="text-xs text-red-600 mt-1">{regErrors.name}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">National ID <span className="text-red-500">*</span></label>
                                    <input type="text" value={regNationalId}
                                        onChange={e => { setRegNationalId(e.target.value); setRegErrors(prev => ({ ...prev, nationalId: '' })); }}
                                        className={`w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500 ${regErrors.nationalId ? 'border-red-400' : 'border-gray-300'}`}
                                        placeholder="e.g., 29901011234567" />
                                    {regErrors.nationalId && <p className="text-xs text-red-600 mt-1">{regErrors.nationalId}</p>}
                                </div>
                            </div>

                            {/* Major & Transfer */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Major</label>
                                    <select value={regMajor} onChange={e => setRegMajor(e.target.value as Major)}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500">
                                        <option value="General">General Program (Years 1-2)</option>
                                        {MAJORS.map(m => (<option key={m.id} value={m.id}>{m.name} ({m.id})</option>))}
                                    </select>
                                </div>
                                <div className="flex items-end">
                                    <label className="flex items-center gap-3 cursor-pointer pb-2">
                                        <div className="relative">
                                            <input type="checkbox" checked={regIsTransfer} onChange={e => setRegIsTransfer(e.target.checked)} className="sr-only" />
                                            <div className={`w-11 h-6 rounded-full transition ${regIsTransfer ? 'bg-green-600' : 'bg-gray-300'}`}></div>
                                            <div className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition transform ${regIsTransfer ? 'translate-x-5' : ''}`}></div>
                                        </div>
                                        <span className="text-sm font-medium text-gray-700">Transfer Student</span>
                                    </label>
                                </div>
                            </div>

                            {regIsTransfer && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Previous University <span className="text-red-500">*</span></label>
                                    <input type="text" value={regPreviousUniversity} onChange={e => setRegPreviousUniversity(e.target.value)}
                                        className={`w-full border rounded-lg px-4 py-2.5 ${regErrors.previousUniversity ? 'border-red-400' : 'border-gray-300'}`}
                                        placeholder="e.g., Cairo University" />
                                    {regErrors.previousUniversity && <p className="text-xs text-red-600 mt-1">{regErrors.previousUniversity}</p>}
                                </div>
                            )}

                            {/* Passed Courses Selector */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Passed Courses ({regPassedCourses.length} selected)</label>
                                <div className="flex gap-2 mb-3">
                                    <div className="flex-1 relative">
                                        <input type="text" value={regCourseSearch} onChange={e => setRegCourseSearch(e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500"
                                            placeholder="Search by course code or name..." />
                                        {regCourseSearch && (
                                            <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                {courses.filter(c => {
                                                    if (regPassedCourses.some(p => p.courseCode === c.code)) return false;
                                                    const s = regCourseSearch.toLowerCase();
                                                    return c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s);
                                                }).slice(0, 15).map(course => (
                                                    <button key={course.code} onClick={() => {
                                                        setRegPassedCourses(prev => [...prev, {
                                                            courseCode: course.code, grade: numericToGrade(regGradeInput),
                                                            gradePoints: numericToGradePoints(regGradeInput), numericGrade: regGradeInput, isTransferred: regIsTransfer,
                                                        }]);
                                                        setRegCourseSearch('');
                                                    }} className="w-full text-left px-4 py-2.5 hover:bg-green-50 border-b border-gray-50 last:border-0 transition">
                                                        <div className="flex justify-between items-center">
                                                            <div><span className="font-medium text-sm text-gray-800">{course.code}</span><span className="text-sm text-gray-500 ml-2">{course.name}</span></div>
                                                            <span className="text-xs text-gray-400">{course.credits} Cr</span>
                                                        </div>
                                                    </button>
                                                ))}
                                                {courses.filter(c => {
                                                    if (regPassedCourses.some(p => p.courseCode === c.code)) return false;
                                                    const s = regCourseSearch.toLowerCase();
                                                    return c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s);
                                                }).length === 0 && <div className="px-4 py-3 text-sm text-gray-400 text-center">No matching courses found</div>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 w-36">
                                        <input type="number" step="1" min="0" max="100" value={regGradeInput}
                                            onChange={e => setRegGradeInput(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                            className="border border-gray-300 rounded-lg px-2 py-2.5 text-sm w-16 text-center" />
                                        <span className="text-xs text-gray-400 whitespace-nowrap">{numericToGrade(regGradeInput)}</span>
                                    </div>
                                </div>
                                {regPassedCourses.length > 0 ? (
                                    <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                                        {regPassedCourses.map(record => {
                                            const course = courses.find(c => c.code === record.courseCode);
                                            return (
                                                <div key={record.courseCode} className="flex justify-between items-center px-4 py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                                    <div className="flex-1"><span className="font-medium text-sm text-gray-800">{record.courseCode}</span><span className="text-sm text-gray-500 ml-2">{course?.name || 'Unknown'}</span></div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs text-gray-400">{record.numericGrade} — {record.grade}</span>
                                                        <button onClick={() => setRegPassedCourses(prev => prev.filter(p => p.courseCode !== record.courseCode))} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">Search and add your passed courses above</div>
                                )}
                            </div>

                            {regErrors.general && <p className="text-sm text-red-600">{regErrors.general}</p>}

                            <button onClick={handleRegister} className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition">
                                Create Account & Continue
                            </button>
                            <div className="text-center pt-2 border-t">
                                <p className="text-sm text-gray-500">Already have an account?{' '}
                                    <button onClick={() => setViewMode('login')} className="text-purple-600 font-semibold hover:text-purple-700">Sign In</button>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ DASHBOARD ============ */}
            {viewMode === 'dashboard' && authenticatedStudent && (
                <div className="max-w-3xl mx-auto space-y-6">
                    {/* Welcome Header */}
                    <div className="bg-white rounded-xl shadow-lg p-6 flex items-center gap-4">
                        {authenticatedStudent.profilePicture ? (
                            <img src={authenticatedStudent.profilePicture} alt="" className="w-16 h-16 rounded-full object-cover border-4 border-purple-200" />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center"><span className="text-2xl">🎓</span></div>
                        )}
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-gray-900">Welcome, {authenticatedStudent.name}</h2>
                            <p className="text-sm text-gray-500">University ID: <span className="font-mono text-indigo-600">{authenticatedStudent.universityId}</span> • Major: {authenticatedStudent.major}</p>
                        </div>
                        {authenticatedStudent.isBlocked && (
                            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">Blocked</span>
                        )}
                    </div>

                    {/* Academic Status */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Academic Status</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-blue-50 rounded-xl p-4 text-center">
                                <p className="text-2xl font-bold text-indigo-600">{computedGPA.toFixed(2)}</p>
                                <p className="text-xs text-gray-500">{gpaClass}<br />GPA</p>
                            </div>
                            <div className="bg-blue-50 rounded-xl p-4 text-center">
                                <p className="text-2xl font-bold text-indigo-600">{computedPassedHours}</p>
                                <p className="text-xs text-gray-500">of ~144h<br />Passed Hours</p>
                            </div>
                            <div className="bg-green-50 rounded-xl p-4 text-center">
                                <p className="text-2xl font-bold text-green-600">{computedLevel}</p>
                                <p className="text-xs text-gray-500">Year {computedLevel}<br />Academic Level</p>
                            </div>
                            <div className="bg-purple-50 rounded-xl p-4 text-center">
                                <p className="text-2xl font-bold text-purple-600">{passedCount}</p>
                                <p className="text-xs text-gray-500">{passedCount} passed<br />Courses</p>
                            </div>
                        </div>
                        <div className="mt-4">
                            <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Progress to Graduation</span><span>{Math.min(100, Math.round((computedPassedHours / 144) * 100))}%</span></div>
                            <div className="bg-gray-100 rounded-full h-2.5"><div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (computedPassedHours / 144) * 100)}%` }} /></div>
                        </div>
                    </div>

                    {/* Approved Plan (from admin) */}
                    {authenticatedStudent.approvedPlan && (
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-800">📋 Approved Semester Plan</h3>
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{authenticatedStudent.approvedPlan.semester}</span>
                            </div>
                            <div className="bg-indigo-50 rounded-lg p-3 mb-3 text-sm">
                                Total: <strong>{authenticatedStudent.approvedPlan.credits}</strong> credit hours • <strong>{authenticatedStudent.approvedPlan.courses.length}</strong> courses
                            </div>
                            <ul className="space-y-2">
                                {authenticatedStudent.approvedPlan.courses.map(code => {
                                    const course = courses.find(c => c.code === code);
                                    return (
                                        <li key={code} className="flex justify-between items-center border rounded-lg p-3 bg-gray-50">
                                            <div><span className="font-medium">{code}</span><span className="text-gray-600 ml-2">{course?.name || 'Unknown'}</span></div>
                                            <span className="font-semibold text-gray-700">{course?.credits || '?'} Cr</span>
                                        </li>
                                    );
                                })}
                            </ul>
                            <p className="text-xs text-gray-400 mt-2">Approved on: {new Date(authenticatedStudent.approvedPlan.approvedAt).toLocaleDateString()}</p>
                        </div>
                    )}

                    {!authenticatedStudent.approvedPlan && (
                        <div className="bg-white rounded-xl shadow-lg p-6 text-center">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3"><span className="text-xl">📋</span></div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">No Approved Plan Yet</h3>
                            <p className="text-sm text-gray-500">Your academic advisor will generate and approve your semester plan. Check back later.</p>
                        </div>
                    )}

                    {/* Ticket History */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Ticket History</h3>
                        {studentTickets.length > 0 ? (
                            <div className="space-y-3">
                                {studentTickets.map(ticket => (
                                    <div key={ticket.id} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className="font-mono text-sm font-medium text-indigo-600">{ticket.id}</span>
                                                <span className="text-xs text-gray-400 ml-3">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ticket.status === 'resolved' ? 'bg-green-100 text-green-700' : ticket.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>
                                                {ticket.status === 'open' ? 'Open' : ticket.status === 'in_progress' ? 'In Progress' : 'Resolved'}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium text-gray-700 mt-1">{ticket.subject}</p>
                                        <p className="text-sm text-gray-500 mt-0.5 truncate">{ticket.message}</p>
                                        {ticket.attachmentName && <p className="text-xs text-blue-500 mt-1">📎 {ticket.attachmentName}</p>}
                                        {ticket.adminReply && (
                                            <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                                                <strong>Admin reply:</strong> {ticket.adminReply}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-400">No tickets submitted yet.</div>
                        )}

                        {/* Ticket Lookup */}
                        <div className="mt-4 pt-4 border-t">
                            <h4 className="text-sm font-semibold text-gray-600 mb-2">Look Up a Ticket</h4>
                            <div className="flex gap-2">
                                <input type="text" value={lookupId} onChange={e => { setLookupId(e.target.value); setLookupResult(undefined); }}
                                    placeholder="Enter ticket number (e.g., TKT-20260305-ABCD)"
                                    className="flex-1 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-green-500" />
                                <button onClick={handleLookupTicket} disabled={!lookupId.trim()}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50">Look Up</button>
                            </div>
                            {lookupResult && (
                                <div className="border rounded-lg p-4 mt-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <div><p className="text-xs text-gray-500">Ticket #</p><p className="font-mono font-medium text-sm">{lookupResult.id}</p></div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${lookupResult.status === 'open' ? 'bg-yellow-100 text-yellow-800' : lookupResult.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                            {lookupResult.status === 'open' ? 'Open' : lookupResult.status === 'in_progress' ? 'In Progress' : 'Resolved'}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium text-gray-700">{lookupResult.subject}</p>
                                    <p className="text-sm text-gray-500">{lookupResult.message}</p>
                                    {lookupResult.adminReply && <div className="bg-gray-50 rounded p-2 mt-2"><p className="text-xs text-gray-500">Admin Reply:</p><p className="text-gray-700 text-xs">{lookupResult.adminReply}</p></div>}
                                    <p className="text-xs text-gray-400 mt-2">Submitted: {new Date(lookupResult.createdAt).toLocaleString()}</p>
                                </div>
                            )}
                            {lookupId && lookupResult === null && <p className="text-center text-sm text-gray-400 py-4">No ticket found with that number.</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* ============ COURSES ============ */}
            {viewMode === 'courses' && authenticatedStudent && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-800">Remaining Courses</h2>
                            <p className="text-sm text-gray-500">{remainingHours} credit hours until graduation</p>
                        </div>
                    </div>

                    <div className="space-y-8">
                        {(Object.entries(coursesByCategory) as [CategoryType, Course[]][]).map(([category, catCourses]) => {
                            const progress = calculateCategoryProgress(category, passedCodes, courses);
                            const mandatoryPct = progress.mandatoryRequired > 0 ? Math.min(100, Math.round((progress.mandatoryCompleted / progress.mandatoryRequired) * 100)) : 100;
                            const electivePct = progress.electiveRequired > 0 ? Math.min(100, Math.round((progress.electiveCompleted / progress.electiveRequired) * 100)) : 100;
                            const isFulfilled = progress.totalCompleted >= progress.totalRequired;

                            const majorForRole = studentMajor !== 'General' ? studentMajor : 'CS';
                            const mandatoryCourses = catCourses.filter(c => getCourseRoleInMajor(c.code, majorForRole) === 'Mandatory');
                            const electiveCourses = catCourses.filter(c => getCourseRoleInMajor(c.code, majorForRole) !== 'Mandatory');

                            const renderCourseCard = (course: Course, isMandatory: boolean) => (
                                <div key={course.code} className={`border border-gray-200 rounded-lg px-3 py-2.5 hover:shadow-sm transition bg-white border-l-2 ${isMandatory ? 'border-l-slate-400' : 'border-l-cyan-300'}`}>
                                    <div className="flex justify-between items-center mb-0.5">
                                        <span className="font-medium text-sm text-gray-800">{course.code}</span>
                                        <span className="text-xs text-gray-400">{course.credits} Cr</span>
                                    </div>
                                    <p className="text-xs text-gray-500 truncate" title={course.name}>{course.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isMandatory ? 'bg-slate-100 text-slate-500' : 'bg-cyan-50 text-cyan-600'}`}>{isMandatory ? 'Mandatory' : 'Elective'}</span>
                                        <span className="text-[10px] text-gray-300">L{course.level} · T{course.term}</span>
                                    </div>
                                </div>
                            );

                            return (
                                <div key={category}>
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-semibold text-gray-800">
                                                {studentMajor !== 'General' && ['cs_major', 'it_major', 'is_major'].includes(category) ? `${studentMajor} Major` : CATEGORY_NAMES[category]}
                                            </h3>
                                            {isFulfilled && (
                                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                    Fulfilled
                                                </span>
                                            )}
                                        </div>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isFulfilled ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                                            {progress.totalCompleted} / {progress.totalRequired} Cr
                                        </span>
                                    </div>
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
                                    {isFulfilled ? (
                                        <div className="text-center py-3 text-sm text-emerald-600 bg-emerald-50/50 rounded-lg border border-emerald-100">All required credits completed.</div>
                                    ) : (
                                        <div className="space-y-3">
                                            {mandatoryCourses.length > 0 && (
                                                <div>
                                                    <h4 className="text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Mandatory</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">{mandatoryCourses.map(c => renderCourseCard(c, true))}</div>
                                                </div>
                                            )}
                                            {electiveCourses.length > 0 && (
                                                <div>
                                                    <h4 className="text-xs font-semibold text-cyan-500 mb-1.5 uppercase tracking-wider">Elective</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">{electiveCourses.map(c => renderCourseCard(c, false))}</div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {studentMajor === 'General' && (
                            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                                <h3 className="text-base font-medium text-gray-400 mb-1">Major Requirements</h3>
                                <p className="text-lg font-bold text-gray-300">0 / 57 Cr</p>
                                <p className="text-xs text-gray-400 mt-1">Specialize in CS, IT, or IS to see major-specific courses</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ============ SUBMIT TICKET ============ */}
            {viewMode === 'ticket' && authenticatedStudent && (
                <div className="max-w-2xl mx-auto">
                    {ticketSubmitted ? (
                        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-3xl">✅</span></div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Ticket Submitted</h2>
                            <p className="text-gray-600 mb-4">Your ticket has been received. Use the tracking number below to check its status.</p>
                            <div className="bg-gray-50 rounded-lg p-4 mb-6">
                                <p className="text-xs text-gray-500">Tracking Number</p>
                                <p className="text-xl font-mono font-bold text-indigo-600">{ticketSubmitted.id}</p>
                            </div>
                            <div className="flex gap-3 justify-center">
                                <button onClick={() => setViewMode('dashboard')} className="px-6 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition">Back to Dashboard</button>
                                <button onClick={() => setTicketSubmitted(null)} className="px-6 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition">Submit Another</button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-lg p-8">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3"><span className="text-2xl">🎫</span></div>
                                <h2 className="text-2xl font-bold text-gray-900">Submit a Ticket</h2>
                                <p className="text-sm text-gray-500 mt-1">Send a request to your academic advisor</p>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject <span className="text-red-500">*</span></label>
                                    <input type="text" value={ticketSubject} onChange={e => { setTicketSubject(e.target.value); setTicketErrors(prev => ({ ...prev, subject: '' })); }}
                                        className={`w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500 ${ticketErrors.subject ? 'border-red-400' : 'border-gray-300'}`}
                                        placeholder="e.g., Course Substitution Request" />
                                    {ticketErrors.subject && <p className="text-xs text-red-600 mt-1">{ticketErrors.subject}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Message <span className="text-red-500">*</span></label>
                                    <textarea value={ticketMessage} onChange={e => { setTicketMessage(e.target.value); setTicketErrors(prev => ({ ...prev, message: '' })); }}
                                        rows={5} className={`w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500 ${ticketErrors.message ? 'border-red-400' : 'border-gray-300'}`}
                                        placeholder="Describe your request in detail..." />
                                    {ticketErrors.message && <p className="text-xs text-red-600 mt-1">{ticketErrors.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Attachment (optional)</label>
                                    <div className={`border-2 border-dashed rounded-lg p-4 text-center transition ${ticketFile ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-300 hover:border-green-300'}`}>
                                        {ticketFile ? (
                                            <div className="flex items-center justify-center gap-3">
                                                <span className="text-sm text-gray-700 font-medium">{ticketFile.name}</span>
                                                <span className="text-xs text-gray-400">({(ticketFile.size / 1024).toFixed(0)} KB)</span>
                                                <button onClick={() => setTicketFile(null)} className="text-xs text-red-500 hover:text-red-700 ml-2">Remove</button>
                                            </div>
                                        ) : (
                                            <label className="cursor-pointer">
                                                <div className="text-sm text-gray-500">Click to upload transcript or document</div>
                                                <div className="text-xs text-gray-400 mt-1">PDF, images, max 10 MB</div>
                                                <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => {
                                                    const file = e.target.files?.[0];
                                                    if (file && file.size <= 10 * 1024 * 1024) setTicketFile(file);
                                                }} />
                                            </label>
                                        )}
                                    </div>
                                </div>
                                <button onClick={handleSubmitTicket} className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition">
                                    Submit Ticket
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="mt-8 flex justify-center">
                <a href="/admin" className="text-gray-600 hover:text-gray-900 text-sm">Admin Dashboard →</a>
            </div>
        </div>
    );
}

export default StudentPortal;
