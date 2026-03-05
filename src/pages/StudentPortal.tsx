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
import { calculateGPA, calculatePassedHours, inferAcademicLevel, getGPAClassification } from '../lib/gradeUtils';
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
    const { getStudentByUniversityId, addStudent: addStudentToContext } = useStudents();

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
        <div className="min-h-screen bg-slate-50 relative overflow-x-hidden">
            {/* Header Area */}
            <div className="bg-university pt-8 pb-16 px-8 relative z-0">
                <div className="max-w-7xl mx-auto flex items-center gap-4">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center p-2 transform rotate-3">
                        <img src="/assets/cai-logo.png" alt="University Logo" className="w-full h-full object-contain -rotate-3" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">Student Portal</h1>
                        <p className="text-university-100 font-medium text-sm drop-shadow-sm max-w-lg mt-1 relative z-10 opacity-90">Academic Advisor System</p>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-8 -mt-8 relative z-10 pb-20">
                {/* Navigation (only when authenticated) */}
                {authenticatedStudent && (
                    <div className="mb-6 flex gap-3 flex-wrap bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                        <button onClick={() => setViewMode('dashboard')}
                            className={`px-5 py-2.5 rounded-xl font-bold transition text-sm flex items-center gap-2 ${viewMode === 'dashboard' ? 'bg-university text-white shadow-md shadow-university/30' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>
                            <span>📊</span> Dashboard
                        </button>
                        <button onClick={() => setViewMode('courses')}
                            className={`px-5 py-2.5 rounded-xl font-bold transition text-sm flex items-center gap-2 ${viewMode === 'courses' ? 'bg-university text-white shadow-md shadow-university/30' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>
                            <span>📚</span> Courses
                        </button>
                        <button onClick={() => { setTicketSubmitted(null); setViewMode('ticket'); }}
                            className={`px-5 py-2.5 rounded-xl font-bold transition text-sm flex items-center gap-2 ${viewMode === 'ticket' ? 'bg-university text-white shadow-md shadow-university/30' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>
                            <span>🎫</span> Submit Ticket
                        </button>
                        <div className="flex-1" />
                        <div className="flex items-center gap-4 pl-4 border-l">
                            <div className="flex items-center gap-3">
                                {authenticatedStudent.profilePicture ? (
                                    <img src={authenticatedStudent.profilePicture} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-university/20 shadow-sm" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-university/10 flex items-center justify-center font-bold text-university border border-university/20 shadow-sm">
                                        {authenticatedStudent.name.charAt(0)}
                                    </div>
                                )}
                                <div>
                                    <span className="block text-sm font-bold text-gray-800">{authenticatedStudent.name}</span>
                                    <span className="block text-xs font-medium text-university-600">{authenticatedStudent.universityId}</span>
                                </div>
                            </div>
                            <button onClick={() => { setAuthenticatedStudent(null); setViewMode('login'); }}
                                className="px-4 py-2 text-xs font-bold bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100 hover:text-red-700 transition">
                                Sign Out
                            </button>
                        </div>
                    </div>
                )}

                {/* ============ LOGIN ============ */}
                {viewMode === 'login' && (
                    <div className="max-w-md mx-auto pt-8">
                        <div className="bg-white rounded-3xl shadow-2xl p-10 border border-gray-100">
                            <div className="text-center mb-8">
                                <div className="w-20 h-20 bg-university/10 rounded-2xl flex items-center justify-center mx-auto mb-4 -rotate-3 border border-university/20">
                                    <span className="text-3xl rotate-3">🎓</span>
                                </div>
                                <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Student Login</h2>
                                <p className="text-sm font-medium text-gray-500 mt-2 uppercase tracking-widest">Access your academic record</p>
                            </div>
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">University ID</label>
                                    <input type="text" value={authUniversityId}
                                        onChange={e => { setAuthUniversityId(e.target.value); setAuthError(''); }}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 font-mono font-medium focus:ring-2 focus:ring-university/40 focus:border-university outline-none transition-all placeholder-gray-400"
                                        placeholder="e.g., 20260001" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">National ID</label>
                                    <input type="text" value={authNationalId}
                                        onChange={e => { setAuthNationalId(e.target.value); setAuthError(''); }}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 font-mono font-medium focus:ring-2 focus:ring-university/40 focus:border-university outline-none transition-all placeholder-gray-400"
                                        placeholder="e.g., 29901011234567" />
                                </div>
                                {authError && <p className="text-xs font-bold text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 text-center">{authError}</p>}

                                <button onClick={handleLogin}
                                    disabled={!authUniversityId.trim() || !authNationalId.trim()}
                                    className="w-full bg-university text-white py-3.5 rounded-xl font-bold hover:bg-university-600 transition-all shadow-lg shadow-university/30 disabled:opacity-50 disabled:shadow-none mt-2 text-sm tracking-wide">
                                    SECURE LOGIN
                                </button>

                                <div className="text-center pt-6 mt-2 border-t border-gray-100">
                                    <p className="text-sm font-medium text-gray-500">
                                        New student?{' '}
                                        <button onClick={() => setViewMode('register')} className="text-university font-bold hover:text-university-700 hover:underline underline-offset-4 decoration-2 transition">Register Account</button>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============ REGISTER ============ */}
                {viewMode === 'register' && (
                    <div className="max-w-3xl mx-auto pt-4">
                        <div className="bg-white rounded-3xl shadow-2xl p-10 border border-gray-100">
                            <div className="text-center mb-8">
                                <div className="w-20 h-20 bg-university/10 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3 border border-university/20">
                                    <span className="text-3xl -rotate-3 text-university font-bold">📝</span>
                                </div>
                                <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Student Enrollment</h2>
                                <p className="text-sm font-medium text-gray-500 mt-2 uppercase tracking-widest">Create your academic profile</p>
                            </div>

                            <div className="space-y-6">
                                {/* Profile Picture */}
                                <div className="flex justify-center border-b border-gray-100 pb-8">
                                    <div className="text-center">
                                        <div className="relative w-28 h-28 mx-auto mb-3">
                                            {regProfilePicture ? (
                                                <img src={regProfilePicture} alt="Profile" className="w-28 h-28 rounded-full object-cover border-4 border-university/20 shadow-sm" />
                                            ) : (
                                                <div className="w-28 h-28 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center shadow-inner hover:bg-gray-100 transition">
                                                    <span className="text-4xl text-gray-300">👤</span>
                                                </div>
                                            )}
                                            <label className="absolute bottom-0 right-0 bg-white border border-gray-200 shadow-sm rounded-full w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-gray-50 hover:text-university transition group">
                                                <span className="text-sm group-hover:scale-110 transition-transform">📷</span>
                                                <input type="file" accept="image/*" className="hidden" onChange={handleProfilePictureUpload} />
                                            </label>
                                        </div>
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Upload Photo</p>
                                        {regErrors.pfp && <p className="text-xs text-red-600 mt-1 font-bold">{regErrors.pfp}</p>}
                                    </div>
                                </div>

                                {/* Name & National ID */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Full Legal Name <span className="text-red-500">*</span></label>
                                        <input type="text" value={regName}
                                            onChange={e => { setRegName(e.target.value); setRegErrors(prev => ({ ...prev, name: '' })); }}
                                            className={`w-full bg-gray-50 border rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-university/40 focus:border-university outline-none transition-all ${regErrors.name ? 'border-red-400 focus:ring-red-200' : 'border-gray-200'}`}
                                            placeholder="e.g., Ahmed Mohamed" />
                                        {regErrors.name && <p className="text-xs text-red-600 mt-1 font-bold">{regErrors.name}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">National ID <span className="text-red-500">*</span></label>
                                        <input type="text" value={regNationalId}
                                            onChange={e => { setRegNationalId(e.target.value); setRegErrors(prev => ({ ...prev, nationalId: '' })); }}
                                            className={`w-full bg-gray-50 border rounded-xl px-4 py-3 text-sm font-medium font-mono focus:ring-2 focus:ring-university/40 focus:border-university outline-none transition-all ${regErrors.nationalId ? 'border-red-400 focus:ring-red-200' : 'border-gray-200'}`}
                                            placeholder="e.g., 29901011234567" />
                                        {regErrors.nationalId && <p className="text-xs text-red-600 mt-1 font-bold">{regErrors.nationalId}</p>}
                                    </div>
                                </div>

                                {/* Major & Transfer */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Major</label>
                                        <select value={regMajor} onChange={e => setRegMajor(e.target.value as Major)}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-university/40 focus:border-university outline-none transition-all">
                                            <option value="General">General Program (Years 1-2)</option>
                                            {MAJORS.map(m => (<option key={m.id} value={m.id}>{m.name} ({m.id})</option>))}
                                        </select>
                                    </div>
                                    <div className="flex items-center pt-5">
                                        <label className="flex items-center gap-3 cursor-pointer p-4 border border-gray-100 bg-gray-50 rounded-xl w-full hover:border-university/30 transition-colors">
                                            <div className="relative">
                                                <input type="checkbox" checked={regIsTransfer} onChange={e => setRegIsTransfer(e.target.checked)} className="sr-only" />
                                                <div className={`w-11 h-6 rounded-full transition-colors ${regIsTransfer ? 'bg-university' : 'bg-gray-300'}`}></div>
                                                <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform transform ${regIsTransfer ? 'translate-x-5' : ''} shadow-sm`}></div>
                                            </div>
                                            <span className="text-sm font-bold text-gray-700">Transfer Student</span>
                                        </label>
                                    </div>
                                </div>

                                {regIsTransfer && (
                                    <div className="p-4 bg-university/5 border border-university/10 rounded-xl mt-2 animate-in fade-in zoom-in-95 duration-200">
                                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Previous University <span className="text-red-500">*</span></label>
                                        <input type="text" value={regPreviousUniversity} onChange={e => setRegPreviousUniversity(e.target.value)}
                                            className={`w-full bg-white border rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-university/40 outline-none transition-all ${regErrors.previousUniversity ? 'border-red-400 focus:ring-red-200' : 'border-gray-200'}`}
                                            placeholder="e.g., Cairo University" />
                                        {regErrors.previousUniversity && <p className="text-xs text-red-600 mt-1 font-bold">{regErrors.previousUniversity}</p>}
                                    </div>
                                )}

                                {/* Passed Courses Selector */}
                                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                                    <label className="block text-sm font-bold text-gray-800 mb-3">Recorded Courses History <span className="text-xs font-medium text-university px-2 py-0.5 bg-university/10 rounded-full ml-2">{regPassedCourses.length} selected</span></label>
                                    <div className="flex gap-2 mb-4 relative">
                                        <div className="flex-1 relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                                            <input type="text" value={regCourseSearch} onChange={e => setRegCourseSearch(e.target.value)}
                                                className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm font-medium focus:ring-2 focus:ring-university/40 focus:border-university outline-none transition-all"
                                                placeholder="Search code or name..." />
                                            {regCourseSearch && (
                                                <div className="absolute z-50 top-full mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
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
                                                        }} className="w-full text-left px-4 py-3 hover:bg-university/5 border-b border-gray-50 last:border-0 transition-colors">
                                                            <div className="flex justify-between items-center">
                                                                <div><span className="font-bold text-sm text-gray-900">{course.code}</span><span className="text-sm text-gray-600 ml-2 font-medium">{course.name}</span></div>
                                                                <span className="text-xs font-bold text-university bg-university/10 px-2 py-1 rounded-md">{course.credits} Cr</span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                    {courses.filter(c => {
                                                        if (regPassedCourses.some(p => p.courseCode === c.code)) return false;
                                                        const s = regCourseSearch.toLowerCase();
                                                        return c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s);
                                                    }).length === 0 && <div className="px-4 py-4 text-sm font-medium text-gray-400 text-center">No matching courses found</div>}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 min-w-[140px]">
                                            <span className="text-xs font-bold text-gray-400 uppercase">Score</span>
                                            <input type="number" step="1" min="0" max="100" value={regGradeInput}
                                                onChange={e => setRegGradeInput(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                                className="w-12 py-3 text-sm font-bold text-center outline-none bg-transparent" />
                                            <div className="h-6 w-px bg-gray-200 mx-1"></div>
                                            <span className={`text-sm font-bold whitespace-nowrap ${numericToGrade(regGradeInput) === 'Fail' ? 'text-red-500' : 'text-green-600'}`}>
                                                {numericToGrade(regGradeInput)}
                                            </span>
                                        </div>
                                    </div>
                                    {regPassedCourses.length > 0 ? (
                                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto shadow-sm">
                                            {regPassedCourses.map(record => {
                                                const course = courses.find(c => c.code === record.courseCode);
                                                return (
                                                    <div key={record.courseCode} className="flex justify-between items-center px-5 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 group transition duration-150">
                                                        <div className="flex-1"><span className="font-bold text-sm text-gray-900">{record.courseCode}</span><span className="text-sm font-medium text-gray-600 ml-3">{course?.name || 'Unknown'}</span></div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-sm font-bold text-gray-900">{record.numericGrade}%</span>
                                                                <span className={`text-xs font-bold ${record.grade === 'Fail' ? 'text-red-500' : 'text-green-600'}`}>{record.grade}</span>
                                                            </div>
                                                            <button onClick={() => setRegPassedCourses(prev => prev.filter(p => p.courseCode !== record.courseCode))}
                                                                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition opacity-0 group-hover:opacity-100">
                                                                ✕
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-sm font-medium text-gray-400 border border-dashed border-gray-300 rounded-xl bg-white">
                                            No courses added. Search to add completed courses.
                                        </div>
                                    )}
                                </div>

                                {regErrors.general && <p className="text-sm font-bold text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 text-center">{regErrors.general}</p>}

                                <div className="pt-4">
                                    <button onClick={handleRegister} className="w-full bg-university text-white py-4 rounded-xl font-bold hover:bg-university-600 transition-all shadow-lg shadow-university/30 text-sm tracking-wide">
                                        ENROLL STUDENT RECORD
                                    </button>
                                </div>

                                <div className="text-center pt-6 pb-2 border-t border-gray-100">
                                    <p className="text-sm font-medium text-gray-500">Already registered?{' '}
                                        <button onClick={() => setViewMode('login')} className="text-university font-bold hover:text-university-700 hover:underline underline-offset-4 decoration-2 transition">Sign In Instead</button>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============ DASHBOARD ============ */}
                {viewMode === 'dashboard' && authenticatedStudent && (
                    <div className="max-w-4xl mx-auto space-y-6">
                        {/* Welcome Header */}
                        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 flex items-center gap-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-university/5 rounded-full -translate-y-1/2 translate-x-1/3 z-0 blur-3xl"></div>
                            <div className="relative z-10">
                                {authenticatedStudent.profilePicture ? (
                                    <img src={authenticatedStudent.profilePicture} alt="" className="w-20 h-20 rounded-full object-cover border-4 border-university/20 shadow-sm" />
                                ) : (
                                    <div className="w-20 h-20 rounded-full bg-university/10 shadow-inner flex items-center justify-center border-2 border-dashed border-university/30"><span className="text-3xl">🎓</span></div>
                                )}
                            </div>
                            <div className="flex-1 relative z-10">
                                <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Welcome back, {authenticatedStudent.name}</h2>
                                <p className="text-sm font-medium text-gray-500 mt-1 uppercase tracking-wider">
                                    ID: <span className="font-mono text-university-700 font-bold">{authenticatedStudent.universityId}</span> <span className="mx-2 opacity-50">•</span> Program: <span className="text-gray-700 font-bold">{authenticatedStudent.major}</span>
                                </p>
                            </div>
                            {authenticatedStudent.isBlocked && (
                                <div className="relative z-10 px-4 py-2 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2">
                                    <span>⚠️</span>
                                    Account Blocked
                                </div>
                            )}
                        </div>

                        {/* Academic Status */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
                                <h3 className="text-sm font-bold text-gray-800 mb-6 uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-university"></span>
                                    Academic Standing
                                </h3>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="bg-university/5 border border-university/10 rounded-2xl p-5 text-center flex flex-col justify-center items-center">
                                        <p className="text-3xl font-extrabold text-university">{computedGPA.toFixed(2)}</p>
                                        <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-wide">{gpaClass}</p>
                                    </div>
                                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 text-center flex flex-col justify-center items-center">
                                        <p className="text-3xl font-extrabold text-gray-800">{computedPassedHours}</p>
                                        <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-wide">of ~144h</p>
                                    </div>
                                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 text-center flex flex-col justify-center items-center">
                                        <p className="text-3xl font-extrabold text-emerald-600">{computedLevel}</p>
                                        <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-wide">Year {computedLevel}</p>
                                    </div>
                                    <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 text-center flex flex-col justify-center items-center">
                                        <p className="text-3xl font-extrabold text-orange-600">{passedCount}</p>
                                        <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-wide">Courses</p>
                                    </div>
                                </div>
                                <div className="mt-8">
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Graduation Progress</span>
                                        <span className="text-sm font-extrabold text-university">{Math.min(100, Math.round((computedPassedHours / 144) * 100))}%</span>
                                    </div>
                                    <div className="bg-gray-100 rounded-full h-3 p-0.5 shadow-inner">
                                        <div className="bg-university h-full rounded-full transition-all duration-1000 ease-out shadow-sm" style={{ width: `${Math.min(100, (computedPassedHours / 144) * 100)}%` }} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {/* Approved Plan (from admin) */}
                                {authenticatedStudent.approvedPlan ? (
                                    <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 h-full flex flex-col">
                                        <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-4">
                                            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                Approved Plan
                                            </h3>
                                            <span className="text-xs font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full">{authenticatedStudent.approvedPlan.semester}</span>
                                        </div>
                                        <div className="bg-green-50/50 border border-green-100 rounded-xl p-4 mb-4 text-center">
                                            <div className="text-2xl font-extrabold text-green-700">{authenticatedStudent.approvedPlan.credits} <span className="text-sm font-bold text-gray-500">Cr</span></div>
                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">{authenticatedStudent.approvedPlan.courses.length} Courses</div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto pr-1">
                                            <ul className="space-y-2">
                                                {authenticatedStudent.approvedPlan.courses.map(code => {
                                                    const course = courses.find(c => c.code === code);
                                                    return (
                                                        <li key={code} className="flex justify-between items-center group">
                                                            <div>
                                                                <span className="font-bold text-sm text-gray-900 group-hover:text-university transition-colors">{code}</span>
                                                            </div>
                                                            <span className="font-bold text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{course?.credits || '?'}</span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                        <p className="text-[10px] font-bold text-gray-400 mt-4 text-center uppercase tracking-widest pt-4 border-t border-gray-50">Approved: {new Date(authenticatedStudent.approvedPlan.approvedAt).toLocaleDateString()}</p>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center h-full flex flex-col justify-center items-center">
                                        <div className="w-16 h-16 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center mb-4"><span className="text-2xl opacity-50">📋</span></div>
                                        <h3 className="text-base font-bold text-gray-800 mb-2">No Plan Available</h3>
                                        <p className="text-sm font-medium text-gray-500">Your academic advisor will generate your semester plan soon.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Ticket History */}
                        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
                            <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                    Support Tickets
                                </h3>
                                <button onClick={() => { setTicketSubmitted(null); setViewMode('ticket'); }} className="text-xs font-bold text-university hover:text-university-700 bg-university/5 hover:bg-university/10 px-3 py-1.5 rounded-lg transition-colors">+ New Ticket</button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                    {studentTickets.length > 0 ? (
                                        studentTickets.map(ticket => (
                                            <div key={ticket.id} className="border border-gray-100 rounded-2xl p-5 hover:bg-gray-50 transition shadow-sm group cursor-pointer" onClick={() => setLookupId(ticket.id)}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-mono text-xs font-bold text-gray-500 group-hover:text-university transition-colors">{ticket.id}</span>
                                                    <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase tracking-widest font-bold ${ticket.status === 'resolved' ? 'bg-green-50 ztext-green-600 border border-green-200' : ticket.status === 'in_progress' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
                                                        {ticket.status === 'open' ? 'Open' : ticket.status === 'in_progress' ? 'In Progress' : 'Resolved'}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-bold text-gray-900 leading-tight mb-1">{ticket.subject}</p>
                                                <p className="text-xs text-gray-500 line-clamp-2">{ticket.message}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                            <p className="text-sm font-bold text-gray-400">No active tickets.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Ticket Lookup */}
                                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 sticky top-4">
                                    <h4 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Track Ticket Status</h4>
                                    <div className="space-y-3">
                                        <input type="text" value={lookupId} onChange={e => { setLookupId(e.target.value); setLookupResult(undefined); }}
                                            placeholder="Ticket ID (e.g. TKT-...)"
                                            className="w-full border border-gray-200 bg-white rounded-xl p-3 text-sm font-mono focus:ring-2 focus:ring-university/40 focus:border-university outline-none transition-all" />
                                        <button onClick={handleLookupTicket} disabled={!lookupId.trim()}
                                            className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-bold shadow-md shadow-gray-900/20 hover:bg-gray-800 transition disabled:opacity-50">Look Up</button>
                                    </div>
                                    {lookupResult && (
                                        <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                                            <div className="flex justify-between items-start mb-3">
                                                <p className="font-mono font-bold text-sm text-university">{lookupResult.id}</p>
                                                <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase tracking-widest font-bold ${lookupResult.status === 'resolved' ? 'bg-green-50 text-green-600 border border-green-200' : lookupResult.status === 'in_progress' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
                                                    {lookupResult.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <p className="text-sm font-bold text-gray-900 mb-1">{lookupResult.subject}</p>
                                            <p className="text-xs font-medium text-gray-500 mb-3">{lookupResult.message}</p>

                                            {lookupResult.adminReply && (
                                                <div className="bg-university/5 rounded-xl p-3 border border-university/10">
                                                    <p className="text-[10px] font-bold text-university-700 uppercase tracking-widest mb-1">Advisor Reply:</p>
                                                    <p className="text-sm font-medium text-gray-800">{lookupResult.adminReply}</p>
                                                </div>
                                            )}
                                            <p className="text-[10px] font-bold text-gray-400 mt-3 pt-3 border-t border-gray-100 uppercase tracking-widest">{new Date(lookupResult.createdAt).toLocaleString()}</p>
                                        </div>
                                    )}
                                    {lookupId && lookupResult === null && <p className="text-center text-xs font-bold text-red-500 bg-red-50 py-3 rounded-xl mt-4 border border-red-100">No ticket found with that number.</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============ COURSES ============ */}
                {viewMode === 'courses' && authenticatedStudent && (
                    <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
                        <div className="flex justify-between items-end mb-8 border-b border-gray-100 pb-4">
                            <div>
                                <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Remaining Courses</h2>
                                <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mt-1">{remainingHours} credit hours until graduation</p>
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
                    <div className="max-w-xl mx-auto">
                        {ticketSubmitted ? (
                            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-10 text-center animate-in zoom-in-95 duration-300">
                                <div className="w-20 h-20 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-green-100 shadow-sm"><span className="text-4xl">✅</span></div>
                                <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Ticket Submitted</h2>
                                <p className="text-sm font-medium text-gray-500 mb-6">Your request is in our system. Use the tracking ID below if needed.</p>
                                <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Tracking Number</p>
                                    <p className="text-xl font-mono font-bold text-university">{ticketSubmitted.id}</p>
                                </div>
                                <div className="flex gap-4 justify-center">
                                    <button onClick={() => setViewMode('dashboard')} className="px-6 py-3.5 bg-university text-white rounded-xl font-bold hover:bg-university-600 transition-all shadow-md shadow-university/20 text-sm">Dashboard</button>
                                    <button onClick={() => setTicketSubmitted(null)} className="px-6 py-3.5 border border-gray-200 bg-white text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm">Submit Another</button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-10">
                                <div className="text-center mb-8">
                                    <div className="w-20 h-20 bg-university/10 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3 border border-university/20"><span className="text-3xl -rotate-3">💬</span></div>
                                    <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Open a Support Ticket</h2>
                                    <p className="text-sm font-medium text-gray-500 mt-2 uppercase tracking-wide">Contact Your Academic Advisor</p>
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Subject <span className="text-red-500">*</span></label>
                                        <input type="text" value={ticketSubject} onChange={e => { setTicketSubject(e.target.value); setTicketErrors(prev => ({ ...prev, subject: '' })); }}
                                            className={`w-full bg-gray-50 border rounded-xl px-4 py-3.5 text-sm font-medium focus:ring-2 focus:ring-university/40 outline-none transition-all ${ticketErrors.subject ? 'border-red-400 focus:ring-red-200' : 'border-gray-200 focus:border-university'}`}
                                            placeholder="e.g., Requesting Course Substitution" />
                                        {ticketErrors.subject && <p className="text-xs text-red-600 font-bold mt-1">{ticketErrors.subject}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Message <span className="text-red-500">*</span></label>
                                        <textarea value={ticketMessage} onChange={e => { setTicketMessage(e.target.value); setTicketErrors(prev => ({ ...prev, message: '' })); }}
                                            rows={6} className={`w-full bg-gray-50 border rounded-xl px-4 py-3.5 text-sm font-medium focus:ring-2 focus:ring-university/40 outline-none transition-all resize-none ${ticketErrors.message ? 'border-red-400 focus:ring-red-200' : 'border-gray-200 focus:border-university'}`}
                                            placeholder="Please describe your situation clearly..." />
                                        {ticketErrors.message && <p className="text-xs font-bold text-red-600 mt-1">{ticketErrors.message}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Attachment <span className="text-gray-400 lowercase font-normal ml-1">(optional)</span></label>
                                        <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${ticketFile ? 'border-university/50 bg-university/5' : 'border-gray-200 hover:border-university/30 bg-gray-50'}`}>
                                            {ticketFile ? (
                                                <div className="flex flex-col items-center justify-center gap-3">
                                                    <span className="text-sm text-gray-900 font-bold">{ticketFile.name}</span>
                                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{(ticketFile.size / 1024).toFixed(0)} KB</span>
                                                    <button onClick={() => setTicketFile(null)} className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition">Remove File</button>
                                                </div>
                                            ) : (
                                                <label className="cursor-pointer flex flex-col items-center w-full h-full">
                                                    <span className="text-2xl mb-2 opacity-50">📤</span>
                                                    <div className="text-sm font-bold text-gray-600">Select File</div>
                                                    <div className="text-xs font-medium text-gray-400 mt-1 uppercase tracking-wider">PDF or Image (Max 10 MB)</div>
                                                    <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => {
                                                        const file = e.target.files?.[0];
                                                        if (file && file.size <= 10 * 1024 * 1024) setTicketFile(file);
                                                    }} />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                    <div className="pt-2">
                                        <button onClick={handleSubmitTicket} className="w-full bg-university text-white py-4 rounded-xl font-bold hover:bg-university-600 transition-all shadow-lg shadow-university/30 text-sm tracking-wide">
                                            SUBMIT TICKET
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* Footer */}
            <div className="mt-4 mb-8 flex justify-center relative z-10 w-full text-center bottom-0">
                <a href="/admin" className="text-gray-400 hover:text-university text-xs font-bold uppercase tracking-widest transition-colors">Admin Portal</a>
            </div>
        </div>
    );
}

export default StudentPortal;
