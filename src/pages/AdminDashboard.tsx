import { useState, useMemo, useEffect } from 'react';
import { useCourses } from '../context/CourseContext';
import { Course, MajorId, Term, CategoryType, CourseLevel } from '../types';
import { MAJORS, getCourseRoleInMajor, inferLevelFromCode, getCourseCategory } from '../data/courses';
import {
    Ticket,
    TicketStatus,
    getAllTickets,
    updateTicketStatus,
} from '../types/ticket';
import { useStudents } from '../context/StudentContext';
import { StudentProfile, StudentPlan } from '../types/student';
import { calculateGPA, calculatePassedHours, inferAcademicLevel, getGPAClassification, toStudentForRoadmap } from '../lib/gradeUtils';
import { generateRoadmap } from '../lib/roadmapLogic';
import { StudentForm } from '../components/StudentForm';
import { StudentProfileView } from '../components/StudentProfileView';
import { useLanguage } from '../context/LanguageContext';


type CategoryFilter = 'all' | 'university' | 'basic-science' | 'college' | 'major' | 'projects';

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
    all: 'All Courses',
    university: 'University',
    'basic-science': 'Basic Science',
    college: 'College',
    major: 'Major',
    projects: 'Projects & Training',
};

// Map database category to filter category
function dbCategoryToFilter(dbCat: CategoryType | undefined, code: string): CategoryFilter {
    const actualCat = dbCat || getCourseCategory(code);
    if (!actualCat) {
        if (code.startsWith('UNV')) return 'university';
        if (code.startsWith('BS')) return 'basic-science';
        if (code.startsWith('TR') || code.startsWith('PR')) return 'projects';
        return 'major';
    }
    if (actualCat === 'university') return 'university';
    if (actualCat === 'basic_science') return 'basic-science';
    if (actualCat === 'college') return 'college';
    if (code.startsWith('TR') || code.startsWith('PR')) return 'projects';
    return 'major';
}

const EMPTY_COURSE: Omit<Course, 'code'> & { code: string } = {
    code: '',
    name: '',
    credits: 3,
    prereqs: [],
    term: 1 as Term,
    level: 1 as CourseLevel,
    requirementType: 'Mandatory',
    category: 'college' as CategoryType,
};

// Simple admin auth constants
const ADMIN_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'; // sha256 of "admin123"

async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function AdminDashboard() {
    const { courses, addCourse, updateCourse, deleteCourse, toggleAvailability, resetToDefaults, exportCourses } = useCourses();
    const { language, toggleLanguage } = useLanguage();

    // Auth state
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return sessionStorage.getItem('admin-auth') === 'true';
    });
    const [passwordInput, setPasswordInput] = useState('');
    const [authError, setAuthError] = useState('');

    const [mainTab, setMainTab] = useState<'courses' | 'tickets' | 'students'>('courses');
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
    const [majorSubtab, setMajorSubtab] = useState<MajorId | 'all'>('all');
    const [editingCourse, setEditingCourse] = useState<Course | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newCourse, setNewCourse] = useState<Course>(EMPTY_COURSE as Course);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [levelFilter, setLevelFilter] = useState<number | 'all'>('all');

    // Form validation
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // Prerequisites text input
    const [prereqText, setPrereqText] = useState('');
    const [editPrereqText, setEditPrereqText] = useState('');

    // Ticket management state
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [ticketFilter, setTicketFilter] = useState<TicketStatus | 'all'>('all');
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [ticketReply, setTicketReply] = useState('');


    const [studentSearch, setStudentSearch] = useState('');

    // Student management state
    const { students, updateStudent } = useStudents();

    const [selectedStudent, setSelectedStudent] = useState<StudentProfile | undefined>(undefined);
    const [showStudentForm, setShowStudentForm] = useState(false);
    const [editingStudent, setEditingStudent] = useState<StudentProfile | undefined>(undefined);
    const [bulkSuccessMsg, setBulkSuccessMsg] = useState('');
    const [showBulkPlanModal, setShowBulkPlanModal] = useState(false);
    const [bulkPlanTargetYear, setBulkPlanTargetYear] = useState('Year 1');
    const [bulkPlanTargetSemester, setBulkPlanTargetSemester] = useState('First Semester');

    const courseLookupFn = (code: string) => courses.find(c => c.code === code);

    const filteredStudents = useMemo(() => {
        if (!studentSearch.trim()) return students;
        const q = studentSearch.toLowerCase();
        return students.filter(s =>
            s.name.toLowerCase().includes(q) ||
            s.nationalId.toLowerCase().includes(q) ||
            (s.universityId && s.universityId.toLowerCase().includes(q))
        );
    }, [students, studentSearch]);

    // Load tickets on mount/tab change
    useEffect(() => {
        if (mainTab === 'tickets') {
            setTickets(getAllTickets());
        }
    }, [mainTab]);

    const filteredTickets = useMemo(() => {
        if (ticketFilter === 'all') return tickets;
        return tickets.filter(t => t.status === ticketFilter);
    }, [tickets, ticketFilter]);

    // Auth handlers
    const handleLogin = async () => {
        const hash = await hashPassword(passwordInput);
        if (hash === ADMIN_HASH) {
            setIsAuthenticated(true);
            sessionStorage.setItem('admin-auth', 'true');
            setAuthError('');
        } else {
            setAuthError('Incorrect password');
        }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        sessionStorage.removeItem('admin-auth');
        setPasswordInput('');
    };

    // Form validation for course creation/editing
    const validateCourseForm = (course: Course & { code: string }, isEdit: boolean = false): Record<string, string> => {
        const errors: Record<string, string> = {};
        if (!isEdit && !course.code.trim()) errors.code = 'Course code is required';
        else if (!isEdit && !/^[A-Za-z]{2,4}\d{2,4}$/.test(course.code.trim())) errors.code = 'Invalid format (e.g. CS101)';
        if (!course.name.trim()) errors.name = 'Course name is required';
        else if (course.name.trim().length < 3) errors.name = 'Minimum 3 characters';
        if (!course.credits || course.credits < 1 || course.credits > 6) errors.credits = 'Must be 1-6';
        return errors;
    };

    const handleResolveTicket = () => {
        if (!selectedTicket) return;
        const updated = updateTicketStatus(selectedTicket.id, 'resolved', ticketReply.trim() || undefined);
        if (updated) {
            setTickets(tickets.map(t => t.id === updated.id ? updated : t));
            setSelectedTicket(null);
            setTicketReply('');
        }
    };

    const handleGeneratePlansForAll = () => {
        let generatedCount = 0;

        // Infer term from semester string
        const inferredTerm: Term = bulkPlanTargetSemester.toLowerCase().includes('second') ? 2 : 1;
        const bulkPlanSemester = `${bulkPlanTargetYear} - ${bulkPlanTargetSemester}`;

        students.forEach(student => {
            if (student.isBlocked) return;

            const roadmapStudent = toStudentForRoadmap(student, courseLookupFn);
            const availableCourses = courses.filter(c => c.available !== false);
            const { roadmap } = generateRoadmap(roadmapStudent, inferredTerm, availableCourses);

            const roadmapCodes = roadmap.map(c => typeof c === 'string' ? c : (c as Course).code);
            const credits = roadmap.reduce((sum, c) => {
                const courseObj = typeof c === 'string' ? courseLookupFn(c) : c;
                return sum + (courseObj?.credits || 0);
            }, 0);

            if (roadmap.length > 0) {
                const newPlan: StudentPlan = {
                    id: `plan-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    semester: bulkPlanSemester,
                    status: 'draft',
                    courses: roadmapCodes,
                    credits,
                    generatedAt: new Date().toISOString(),
                };

                // Remove any existing plan for this semester to prevent duplicates
                const existingPlans = student.plans || [];
                const filteredPlans = existingPlans.filter(p => p.semester !== bulkPlanSemester);

                updateStudent({
                    ...student,
                    plans: [...filteredPlans, newPlan],
                });
                generatedCount++;
            }
        });

        setBulkSuccessMsg(`Successfully generated draft plans for ${generatedCount} students.`);
        setShowBulkPlanModal(false);
        setTimeout(() => setBulkSuccessMsg(''), 5000);
    };



    // Filter courses
    const filteredCourses = useMemo(() => {
        let result = courses;

        // Category filter
        if (categoryFilter === 'college') {
            result = result.filter(c => dbCategoryToFilter(c.category, c.code) === 'college');
        } else if (categoryFilter === 'major') {
            result = result.filter(c => {
                const cat = dbCategoryToFilter(c.category, c.code);
                if (cat !== 'major') return false;
                if (majorSubtab !== 'all') {
                    const role = getCourseRoleInMajor(c.code, majorSubtab);
                    return role !== 'N/A';
                }
                return true;
            });
        } else if (categoryFilter !== 'all') {
            result = result.filter(c => dbCategoryToFilter(c.category, c.code) === categoryFilter);
        }

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                c => c.code.toLowerCase().includes(query) || c.name.toLowerCase().includes(query)
            );
        }

        // Level filter
        if (levelFilter !== 'all') {
            result = result.filter(c => {
                const courseLevel = c.level || inferLevelFromCode(c.code);
                return courseLevel === levelFilter;
            });
        }

        return result;
    }, [courses, categoryFilter, majorSubtab, searchQuery, levelFilter]);

    const handleSaveEdit = () => {
        if (editingCourse) {
            const errors = validateCourseForm(editingCourse, true);
            if (Object.keys(errors).length > 0) {
                setFormErrors(errors);
                return;
            }
            // Parse prereqs from text
            const prereqs = editPrereqText.split(',').map(s => s.trim()).filter(Boolean);
            updateCourse(editingCourse.code, { ...editingCourse, prereqs });
            setEditingCourse(null);
            setFormErrors({});
        }
    };

    const handleCreateCourse = () => {
        const errors = validateCourseForm(newCourse);
        if (courses.some(c => c.code === newCourse.code)) {
            errors.code = 'Course code already exists';
        }
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        // Parse prereqs from text
        const prereqs = prereqText.split(',').map(s => s.trim()).filter(Boolean);
        addCourse({ ...newCourse, prereqs });
        setNewCourse(EMPTY_COURSE as Course);
        setPrereqText('');
        setIsCreating(false);
        setFormErrors({});
    };

    const handleDeleteConfirm = (code: string) => {
        deleteCourse(code);
        setDeleteConfirm(null);
    };

    // Get requirement type for display
    const getDisplayType = (code: string): "Mandatory" | "Elective" | "N/A" => {
        if (majorSubtab !== 'all') {
            return getCourseRoleInMajor(code, majorSubtab);
        }
        const csRole = getCourseRoleInMajor(code, 'CS');
        const isRole = getCourseRoleInMajor(code, 'IS');
        const itRole = getCourseRoleInMajor(code, 'IT');
        if (csRole === 'Mandatory' || isRole === 'Mandatory' || itRole === 'Mandatory') return 'Mandatory';
        if (csRole === 'Elective' || isRole === 'Elective' || itRole === 'Elective') return 'Elective';
        return 'N/A';
    };

    // ========== AUTH GATE ==========
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-96 bg-university transform -skew-y-3 origin-top-left -translate-y-20 z-0"></div>

                <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-sm relative z-10 border border-gray-100">
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-university/10 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3 shadow-sm border border-university/20 p-3">
                            <img src="/assets/cai-logo.png" alt="University Logo" className="w-full h-full object-contain -rotate-3" />
                        </div>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Admin Portal</h1>
                        <p className="text-sm font-medium text-gray-500 mt-2 uppercase tracking-widest">Authorized Access Only</p>
                    </div>
                    <div className="space-y-5">
                        <div className="relative">
                            <input
                                type="password"
                                value={passwordInput}
                                onChange={e => { setPasswordInput(e.target.value); setAuthError(''); }}
                                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3.5 focus:ring-2 focus:ring-university/40 focus:border-university outline-none transition-all font-medium text-gray-800 placeholder-gray-400"
                                placeholder="Enter Admin Password"
                                autoFocus
                            />
                        </div>
                        {authError && <p className="text-xs font-bold text-red-600 bg-red-50 p-2 text-center rounded-lg border border-red-100">{authError}</p>}
                        <button
                            onClick={handleLogin}
                            className="w-full bg-[#0160C9] text-white py-3.5 rounded-xl font-bold hover:bg-blue-800 transition-all shadow-lg text-sm tracking-wide"
                        >
                            SECURE LOG IN
                        </button>
                        <a href="/portal" className="block text-center text-xs font-bold text-gray-400 hover:text-university uppercase tracking-wider mt-6 transition-colors">
                            ← Return to Student Portal
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 relative overflow-x-hidden">
            {/* Header Area */}
            <div className="bg-white border-b border-gray-200 pt-8 pb-32 px-8 relative z-0 shadow-sm">
                <div className="max-w-7xl mx-auto flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-[#0160C9]/5 border border-[#0160C9]/10 rounded-2xl shadow-sm flex items-center justify-center p-2 transform rotate-3">
                            <img src="/assets/cai-logo.png" alt="University Logo" className="w-full h-full object-contain -rotate-3" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold text-[#0160C9] tracking-tight">Damietta University Dashboard</h1>
                            <p className="text-gray-500 font-medium text-sm max-w-lg mt-1 relative z-10">Faculty of Computer Science and Artificial Intelligence • Academic Advisor System</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={toggleLanguage} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition text-sm font-bold border border-gray-200">
                            {language === 'en' ? 'العربية' : 'English'}
                        </button>
                        <a href="/portal" className="px-4 py-2 bg-[#0160C9] text-white rounded-xl hover:bg-blue-800 transition text-sm font-bold shadow-sm">
                            Portal View
                        </a>
                        <button onClick={handleLogout} className="px-4 py-2 bg-red-500/90 text-white rounded-xl hover:bg-red-600 transition text-sm font-semibold border border-red-400">
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Interface */}
            <div className="max-w-7xl mx-auto px-8 -mt-24 relative z-10 pb-20">
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden min-h-[70vh] flex flex-col">

                    {/* Main Tabs */}
                    <div className="flex px-6 pt-4 border-b border-gray-100 bg-gray-50/50 sticky top-0 z-20 backdrop-blur-md">
                        <button
                            onClick={setMainTab.bind(null, 'courses')}
                            className={`px-6 py-4 font-bold transition border-b-2 -mb-px text-sm tracking-wide ${mainTab === 'courses'
                                ? 'border-[#0160C9] text-[#0160C9]'
                                : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'
                                }`}
                        >
                            📚 COURSES
                        </button>

                        <button
                            onClick={setMainTab.bind(null, 'tickets')}
                            className={`px-6 py-4 font-bold transition border-b-2 -mb-px text-sm tracking-wide flex items-center gap-2 ${mainTab === 'tickets'
                                ? 'border-[#0160C9] text-[#0160C9]'
                                : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'
                                }`}
                        >
                            🎫 TICKETS
                            {tickets.filter(t => t.status === 'open').length > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] text-white ${mainTab === 'tickets' ? 'bg-[#0160C9]' : 'bg-gray-400'}`}>
                                    {tickets.filter(t => t.status === 'open').length}
                                </span>
                            )}
                        </button>

                        <button
                            onClick={setMainTab.bind(null, 'students')}
                            className={`px-6 py-4 font-bold transition border-b-2 -mb-px text-sm tracking-wide flex items-center gap-2 ${mainTab === 'students'
                                ? 'border-[#0160C9] text-[#0160C9]'
                                : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'
                                }`}
                        >
                            👨‍🎓 STUDENTS
                            <span className={`px-2 py-0.5 rounded-full text-[10px] text-white ${mainTab === 'students' ? 'bg-[#0160C9]' : 'bg-gray-400'}`}>
                                {students.length}
                            </span>
                        </button>
                    </div>

                    <div className="p-8 flex-1">
                        {/* Tickets Tab */}
                        {mainTab === 'tickets' && (
                            <div className="space-y-6">
                                <div className="flex gap-2">
                                    {(['all', 'open', 'in_progress', 'resolved'] as const).map(status => (
                                        <button key={status} onClick={() => setTicketFilter(status)}
                                            className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize ${ticketFilter === status
                                                ? 'bg-[#0160C9] text-white' : 'bg-white text-gray-700 border'}`}>
                                            {status.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>

                                <div className="bg-white rounded-lg shadow overflow-hidden">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attachment</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {filteredTickets.map(ticket => (
                                                <tr key={ticket.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ticket.id}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {ticket.studentName}<br />
                                                        <span className="text-xs text-gray-400">{ticket.studentId}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{ticket.subject}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {ticket.attachmentName ? (
                                                            <span className="text-blue-600">📎 {ticket.attachmentName}</span>
                                                        ) : (<span className="text-gray-300">—</span>)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${ticket.status === 'open' ? 'bg-yellow-100 text-yellow-800' :
                                                            ticket.status === 'in_progress' ? 'bg-[#0160C9]/10 text-[#0160C9]' :
                                                                'bg-green-100 text-green-800'}`}>
                                                            {ticket.status.replace('_', ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {new Date(ticket.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedTicket(ticket);
                                                                setTicketReply(ticket.adminReply || '');
                                                                if (ticket.status === 'open') {
                                                                    const updated = updateTicketStatus(ticket.id, 'in_progress');
                                                                    if (updated) setTickets(tickets.map(t => t.id === updated.id ? updated : t));
                                                                }
                                                            }}
                                                            className="px-3 py-1 bg-university/10 text-university-700 rounded-lg hover:bg-university/20 transition font-bold text-xs"
                                                        >
                                                            Review
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {filteredTickets.length === 0 && (
                                        <div className="p-8 text-center text-gray-500">No tickets found.</div>
                                    )}
                                </div>

                                {selectedTicket && (
                                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
                                        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
                                            <div className="flex justify-between items-start mb-6">
                                                <h2 className="text-2xl font-bold text-gray-900">Ticket: {selectedTicket.id}</h2>
                                                <button onClick={() => setSelectedTicket(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="bg-gray-50 p-4 rounded-lg">
                                                    <p className="text-sm"><span className="text-gray-500">Student:</span> {selectedTicket.studentName} ({selectedTicket.studentId})</p>
                                                    <p className="text-sm mt-1"><span className="text-gray-500">Subject:</span> <strong>{selectedTicket.subject}</strong></p>
                                                </div>
                                                <div className="border rounded-lg p-4">
                                                    <h4 className="text-sm font-medium text-gray-700 mb-2">Message</h4>
                                                    <p className="text-gray-700 whitespace-pre-wrap">{selectedTicket.message}</p>
                                                </div>
                                                {selectedTicket.attachmentData && (
                                                    <div className="border rounded-lg p-4">
                                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Attachment</h4>
                                                        <a href={selectedTicket.attachmentData} download={selectedTicket.attachmentName || 'attachment'}
                                                            className="text-[#0160C9] hover:text-blue-800 font-bold inline-flex items-center gap-1">
                                                            📎 Download {selectedTicket.attachmentName}
                                                        </a>
                                                    </div>
                                                )}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Admin Reply</label>
                                                    <textarea value={ticketReply} onChange={e => setTicketReply(e.target.value)}
                                                        className="w-full border rounded-md p-2 text-sm" rows={3}
                                                        placeholder="Write a reply to the student..." />
                                                </div>
                                                <div className="flex justify-end gap-3 pt-4 border-t">
                                                    <button onClick={() => setSelectedTicket(null)} className="px-4 py-2 border rounded-md hover:bg-gray-50">Close</button>
                                                    <button onClick={handleResolveTicket} className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium">
                                                        Resolve Ticket
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}



                        {/* Students Tab */}
                        {mainTab === 'students' && (
                            <div className="space-y-6">
                                {/* Bulk Plan Generation Section */}
                                <div className="bg-university/5 rounded-2xl p-5 border border-university/10 flex flex-col md:flex-row items-start md:items-center justify-between shadow-sm gap-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-university-900 mb-1">Bulk Generate Plans</h3>
                                        <p className="text-xs text-university-700/80">Automatically create draft degree plans for all registered students.</p>
                                    </div>
                                    <div className="flex gap-3 items-center w-full md:w-auto">
                                        {bulkSuccessMsg && <span className="text-xs font-bold text-green-700 bg-green-100 px-3 py-1.5 rounded-lg mr-2">{bulkSuccessMsg}</span>}
                                        {!showBulkPlanModal ? (
                                            <button
                                                onClick={() => setShowBulkPlanModal(true)}
                                                className="px-5 py-2.5 bg-[#0160C9] text-white rounded-xl hover:bg-blue-800 font-bold text-sm shadow-md transition-all whitespace-nowrap"
                                            >
                                                Generate Plans
                                            </button>
                                        ) : (
                                            <div className="flex flex-col sm:flex-row gap-2 bg-white p-2 rounded-xl border object-contain border-university-200">
                                                <select
                                                    value={bulkPlanTargetYear}
                                                    onChange={e => setBulkPlanTargetYear(e.target.value)}
                                                    className="bg-transparent text-sm font-medium focus:outline-none px-2 py-1 cursor-pointer"
                                                >
                                                    <option value="Year 1">Year 1</option>
                                                    <option value="Year 2">Year 2</option>
                                                    <option value="Year 3">Year 3</option>
                                                    <option value="Year 4">Year 4</option>
                                                </select>
                                                <div className="w-px h-6 bg-gray-200 hidden sm:block self-center"></div>
                                                <select
                                                    value={bulkPlanTargetSemester}
                                                    onChange={e => setBulkPlanTargetSemester(e.target.value)}
                                                    className="bg-transparent text-sm font-medium focus:outline-none px-2 py-1 cursor-pointer"
                                                >
                                                    <option value="First Semester">First Semester</option>
                                                    <option value="Second Semester">Second Semester</option>
                                                </select>
                                                <button
                                                    onClick={handleGeneratePlansForAll}
                                                    className="px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold text-xs shadow-sm ml-2 transition-all whitespace-nowrap"
                                                >
                                                    ✓ Confirm
                                                </button>
                                                <button
                                                    onClick={() => setShowBulkPlanModal(false)}
                                                    className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 hover:text-gray-700 font-bold text-xs shadow-sm transition-all"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Search and Add */}
                                <div className="flex gap-4">
                                    <div className="relative flex-1">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                                        <input
                                            type="text"
                                            placeholder="Search students by name, national ID, or university ID..."
                                            value={studentSearch}
                                            onChange={e => setStudentSearch(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm font-medium focus:ring-2 focus:ring-university/40 focus:border-university outline-none transition-all text-gray-900 placeholder-gray-400"
                                        />
                                    </div>
                                    <button
                                        onClick={() => { setEditingStudent(undefined); setShowStudentForm(true); }}
                                        className="px-6 py-3 bg-[#0160C9] text-white rounded-xl hover:bg-blue-800 font-bold text-sm shadow-md shadow-blue-900/10 transition-all flex items-center gap-2"
                                    >
                                        <span className="text-white">+</span> <span className="text-white">Add Student</span>
                                    </button>
                                </div>

                                {/* Student List */}
                                <div className="bg-white rounded-lg shadow overflow-hidden">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">University ID</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">National ID</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Major</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GPA</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {filteredStudents.map(student => {
                                                const gpa = calculateGPA(student.passedCourses, courseLookupFn);
                                                const hrs = calculatePassedHours(student.passedCourses, courseLookupFn);
                                                const lvl = inferAcademicLevel(hrs);
                                                const cls = getGPAClassification(gpa);
                                                return (
                                                    <tr key={student.nationalId} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedStudent(student)}>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.name}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#0160C9]/90 font-mono font-medium">{student.universityId || '—'}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{student.nationalId}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.major}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                            <span className="font-medium">{gpa.toFixed(2)}</span>
                                                            <span className="text-xs text-gray-400 ml-1">{cls}</span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Level {lvl}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{hrs}h</td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex gap-1">
                                                                {student.isTransfer && (
                                                                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">Transfer</span>
                                                                )}
                                                                {student.isBlocked && (
                                                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Blocked</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setSelectedStudent(student); }}
                                                                className="text-[#0160C9] hover:text-blue-900 font-bold"
                                                            >
                                                                View
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    {filteredStudents.length === 0 && (
                                        <div className="p-8 text-center text-gray-500">
                                            {students.length === 0
                                                ? 'No students yet. Click "+ Add Student" to create one.'
                                                : 'No students match your search.'}
                                        </div>
                                    )}
                                </div>

                                {/* Student Form Modal */}
                                {showStudentForm && (
                                    <StudentForm
                                        existingStudent={editingStudent}
                                        onClose={() => setShowStudentForm(false)}
                                        onSaved={() => setShowStudentForm(false)}
                                    />
                                )}

                                {/* Student Profile View Modal */}
                                {selectedStudent && (
                                    <StudentProfileView
                                        student={selectedStudent}
                                        onClose={() => setSelectedStudent(undefined)}
                                        onDeleted={() => setSelectedStudent(undefined)}
                                        onUpdated={() => {
                                            // Refresh happens via context
                                        }}
                                    />
                                )}
                            </div>
                        )}



                        {/* Courses Tab */}
                        {
                            mainTab === 'courses' && (
                                <>
                                    {/* Category Tabs - FIXED: proper Tailwind classes */}
                                    <div className="flex gap-2 mb-2 flex-wrap">
                                        {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => {
                                                    setCategoryFilter(cat);
                                                    if (cat !== 'major') setMajorSubtab('all');
                                                }}
                                                className={`px-4 py-2 rounded-md text-sm font-medium transition ${categoryFilter === cat
                                                    ? 'bg-[#0160C9] text-white shadow-md shadow-blue-900/10'
                                                    : 'bg-white text-gray-700 hover:bg-gray-50 border'
                                                    }`}
                                            >
                                                {CATEGORY_LABELS[cat]}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Major Subtabs - FIXED */}
                                    {categoryFilter === 'major' && (
                                        <div className="flex gap-2 mb-4 ml-4">
                                            <button
                                                onClick={() => setMajorSubtab('all')}
                                                className={`px-3 py-1.5 rounded text-xs font-medium transition ${majorSubtab === 'all'
                                                    ? 'bg-[#0160C9] text-white'
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                    }`}
                                            >
                                                All Majors
                                            </button>
                                            {MAJORS.map(major => (
                                                <button
                                                    key={major.id}
                                                    onClick={() => setMajorSubtab(major.id)}
                                                    className={`px-3 py-1.5 rounded text-xs font-medium transition ${majorSubtab === major.id
                                                        ? 'bg-[#0160C9] text-white'
                                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                        }`}
                                                >
                                                    {major.id}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Search, Level Filter & Add */}
                                    <div className="flex gap-4 mb-4">
                                        <input
                                            type="text"
                                            placeholder="Search courses..."
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            className="flex-1 border rounded-md px-4 py-2"
                                        />
                                        <select
                                            value={levelFilter}
                                            onChange={e => setLevelFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                                            className="border rounded-md px-4 py-2 bg-white"
                                        >
                                            <option value="all">All Levels</option>
                                            <option value={1}>Level 1</option>
                                            <option value={2}>Level 2</option>
                                            <option value={3}>Level 3</option>
                                            <option value={4}>Level 4</option>
                                        </select>
                                        <button
                                            onClick={() => { setIsCreating(true); setFormErrors({}); }}
                                            className="px-4 py-2 bg-[#0160C9] text-white font-bold rounded-md hover:bg-blue-800 transition shadow-sm"
                                        >
                                            + Add Course
                                        </button>
                                        <button onClick={exportCourses} className="px-4 py-2 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-md transition text-sm font-semibold border border-gray-200 ml-auto">
                                            Export JSON
                                        </button>
                                        <button onClick={resetToDefaults} className="px-4 py-2 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-md transition text-sm font-semibold border border-gray-200">
                                            Reset Data
                                        </button>
                                    </div>

                                    {/* Create Course Modal - Enhanced with all fields */}
                                    {isCreating && (
                                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                            <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                                                <h2 className="text-xl font-bold mb-4">Add New Course</h2>
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1">Course Code <span className="text-red-500">*</span></label>
                                                        <input
                                                            type="text"
                                                            value={newCourse.code}
                                                            onChange={e => setNewCourse({ ...newCourse, code: e.target.value.toUpperCase() })}
                                                            className={`w-full border rounded-md px-3 py-2 ${formErrors.code ? 'border-red-400' : ''}`}
                                                            placeholder="e.g., CS101"
                                                        />
                                                        {formErrors.code && <p className="text-xs text-red-600 mt-1">{formErrors.code}</p>}
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1">Course Name <span className="text-red-500">*</span></label>
                                                        <input
                                                            type="text"
                                                            value={newCourse.name}
                                                            onChange={e => setNewCourse({ ...newCourse, name: e.target.value })}
                                                            className={`w-full border rounded-md px-3 py-2 ${formErrors.name ? 'border-red-400' : ''}`}
                                                        />
                                                        {formErrors.name && <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-sm font-medium mb-1">Credits <span className="text-red-500">*</span></label>
                                                            <input
                                                                type="number"
                                                                value={newCourse.credits}
                                                                onChange={e => setNewCourse({ ...newCourse, credits: parseInt(e.target.value) || 3 })}
                                                                className={`w-full border rounded-md px-3 py-2 ${formErrors.credits ? 'border-red-400' : ''}`}
                                                                min={1}
                                                                max={6}
                                                            />
                                                            {formErrors.credits && <p className="text-xs text-red-600 mt-1">{formErrors.credits}</p>}
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium mb-1">Term</label>
                                                            <select
                                                                value={newCourse.term}
                                                                onChange={e => setNewCourse({ ...newCourse, term: parseInt(e.target.value) as Term })}
                                                                className="w-full border rounded-md px-3 py-2"
                                                            >
                                                                <option value={1}>Term 1</option>
                                                                <option value={2}>Term 2</option>
                                                                <option value={3}>Summer</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-sm font-medium mb-1">Level</label>
                                                            <select
                                                                value={newCourse.level || 1}
                                                                onChange={e => setNewCourse({ ...newCourse, level: parseInt(e.target.value) as CourseLevel })}
                                                                className="w-full border rounded-md px-3 py-2"
                                                            >
                                                                <option value={1}>Level 1</option>
                                                                <option value={2}>Level 2</option>
                                                                <option value={3}>Level 3</option>
                                                                <option value={4}>Level 4</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium mb-1">Requirement Type</label>
                                                            <select
                                                                value={newCourse.requirementType || 'Mandatory'}
                                                                onChange={e => setNewCourse({ ...newCourse, requirementType: e.target.value as 'Mandatory' | 'Elective' })}
                                                                className="w-full border rounded-md px-3 py-2"
                                                            >
                                                                <option value="Mandatory">Mandatory</option>
                                                                <option value="Elective">Elective</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1">Category</label>
                                                        <select
                                                            value={newCourse.category || 'college'}
                                                            onChange={e => setNewCourse({ ...newCourse, category: e.target.value as CategoryType })}
                                                            className="w-full border rounded-md px-3 py-2"
                                                        >
                                                            <option value="university">University Requirements</option>
                                                            <option value="basic_science">Basic Science</option>
                                                            <option value="college">College Requirements</option>
                                                            <option value="cs_major">CS Major</option>
                                                            <option value="it_major">IT Major</option>
                                                            <option value="is_major">IS Major</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1">Prerequisites (comma-separated codes)</label>
                                                        <input
                                                            type="text"
                                                            value={prereqText}
                                                            onChange={e => setPrereqText(e.target.value.toUpperCase())}
                                                            className="w-full border rounded-md px-3 py-2"
                                                            placeholder="e.g., CS101,CS102"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end gap-3 mt-6">
                                                    <button
                                                        onClick={() => { setIsCreating(false); setNewCourse(EMPTY_COURSE as Course); setFormErrors({}); setPrereqText(''); }}
                                                        className="px-4 py-2 border rounded-md hover:bg-gray-50"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={handleCreateCourse}
                                                        className="px-4 py-2 bg-[#0160C9] text-white rounded-md hover:bg-blue-800 font-bold"
                                                    >
                                                        Create Course
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Edit Course Modal - Enhanced with all fields */}
                                    {editingCourse && (
                                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                            <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                                                <h2 className="text-xl font-bold mb-4">Edit Course: {editingCourse.code}</h2>
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1">Course Name <span className="text-red-500">*</span></label>
                                                        <input
                                                            type="text"
                                                            value={editingCourse.name}
                                                            onChange={e => setEditingCourse({ ...editingCourse, name: e.target.value })}
                                                            className={`w-full border rounded-md px-3 py-2 ${formErrors.name ? 'border-red-400' : ''}`}
                                                        />
                                                        {formErrors.name && <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-sm font-medium mb-1">Credits</label>
                                                            <input
                                                                type="number"
                                                                value={editingCourse.credits}
                                                                onChange={e => setEditingCourse({ ...editingCourse, credits: parseInt(e.target.value) || 3 })}
                                                                className={`w-full border rounded-md px-3 py-2 ${formErrors.credits ? 'border-red-400' : ''}`}
                                                                min={1}
                                                                max={6}
                                                            />
                                                            {formErrors.credits && <p className="text-xs text-red-600 mt-1">{formErrors.credits}</p>}
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium mb-1">Term</label>
                                                            <select
                                                                value={editingCourse.term}
                                                                onChange={e => setEditingCourse({ ...editingCourse, term: parseInt(e.target.value) as Term })}
                                                                className="w-full border rounded-md px-3 py-2"
                                                            >
                                                                <option value={1}>Term 1</option>
                                                                <option value={2}>Term 2</option>
                                                                <option value={3}>Summer</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-sm font-medium mb-1">Level</label>
                                                            <select
                                                                value={editingCourse.level || 1}
                                                                onChange={e => setEditingCourse({ ...editingCourse, level: parseInt(e.target.value) as CourseLevel })}
                                                                className="w-full border rounded-md px-3 py-2"
                                                            >
                                                                <option value={1}>Level 1</option>
                                                                <option value={2}>Level 2</option>
                                                                <option value={3}>Level 3</option>
                                                                <option value={4}>Level 4</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium mb-1">Requirement Type</label>
                                                            <select
                                                                value={editingCourse.requirementType || 'Mandatory'}
                                                                onChange={e => setEditingCourse({ ...editingCourse, requirementType: e.target.value as 'Mandatory' | 'Elective' })}
                                                                className="w-full border rounded-md px-3 py-2"
                                                            >
                                                                <option value="Mandatory">Mandatory</option>
                                                                <option value="Elective">Elective</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1">Category</label>
                                                        <select
                                                            value={editingCourse.category || 'college'}
                                                            onChange={e => setEditingCourse({ ...editingCourse, category: e.target.value as CategoryType })}
                                                            className="w-full border rounded-md px-3 py-2"
                                                        >
                                                            <option value="university">University Requirements</option>
                                                            <option value="basic_science">Basic Science</option>
                                                            <option value="college">College Requirements</option>
                                                            <option value="cs_major">CS Major</option>
                                                            <option value="it_major">IT Major</option>
                                                            <option value="is_major">IS Major</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1">Prerequisites (comma-separated codes)</label>
                                                        <input
                                                            type="text"
                                                            value={editPrereqText}
                                                            onChange={e => setEditPrereqText(e.target.value.toUpperCase())}
                                                            className="w-full border rounded-md px-3 py-2"
                                                            placeholder="e.g., CS101,CS102"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end gap-3 mt-6">
                                                    <button
                                                        onClick={() => { setEditingCourse(null); setFormErrors({}); }}
                                                        className="px-4 py-2 border rounded-md hover:bg-gray-50"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={handleSaveEdit}
                                                        className="px-4 py-2 bg-[#0160C9] text-white rounded-md hover:bg-blue-800 font-bold"
                                                    >
                                                        Save Changes
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Delete Confirmation */}
                                    {deleteConfirm && (
                                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                            <div className="bg-white rounded-lg p-6 w-full max-w-sm">
                                                <h2 className="text-lg font-bold mb-4">Delete Course?</h2>
                                                <p className="text-gray-600 mb-6">
                                                    Are you sure you want to delete <strong>{deleteConfirm}</strong>? This action cannot be undone.
                                                </p>
                                                <div className="flex justify-end gap-3">
                                                    <button
                                                        onClick={() => setDeleteConfirm(null)}
                                                        className="px-4 py-2 border rounded-md hover:bg-gray-50"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteConfirm(deleteConfirm)}
                                                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Course Table - FIXED: toggle, added Level column, improved Type vs Action styling */}
                                    <div className="bg-white rounded-lg shadow overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16">Active</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cr</th>
                                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Level</th>
                                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Term</th>
                                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Type</th>
                                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {filteredCourses.map(course => (
                                                        <tr key={course.code} className={course.available === false ? 'bg-gray-50 opacity-60' : ''}>
                                                            {/* FIXED: Toggle switch with proper Tailwind classes */}
                                                            <td className="px-4 py-3 text-center">
                                                                <button
                                                                    onClick={() => toggleAvailability(course.code)}
                                                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${course.available !== false ? 'bg-green-500' : 'bg-gray-200'}`}
                                                                    role="switch"
                                                                    aria-checked={course.available !== false}
                                                                >
                                                                    <span
                                                                        aria-hidden="true"
                                                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${course.available !== false ? 'translate-x-5' : 'translate-x-0'}`}
                                                                    />
                                                                </button>
                                                            </td>
                                                            <td className="px-4 py-3 font-mono text-sm">{course.code}</td>
                                                            <td className="px-4 py-3 text-sm">{course.name}</td>
                                                            <td className="px-4 py-3 text-center text-sm">{course.credits}</td>
                                                            <td className="px-4 py-3 text-center text-sm">
                                                                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium text-gray-600">
                                                                    L{course.level || inferLevelFromCode(course.code)}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center text-sm text-gray-600">
                                                                T{course.term ?? '?'}
                                                            </td>
                                                            {/* Type column - IMPROVED: distinct styling from actions */}
                                                            <td className="px-4 py-3 text-center text-sm">
                                                                {getDisplayType(course.code) === 'Mandatory' ? (
                                                                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                                                        Mandatory
                                                                    </span>
                                                                ) : getDisplayType(course.code) === 'Elective' ? (
                                                                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200">
                                                                        Elective
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                                                                        N/A
                                                                    </span>
                                                                )}
                                                            </td>
                                                            {/* Actions column - kept with blue theme but using outlined style */}
                                                            <td className="px-4 py-3 text-center">
                                                                <div className="flex justify-center gap-2">
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingCourse(course);
                                                                            setEditPrereqText(course.prereqs?.join(', ') || '');
                                                                            setFormErrors({});
                                                                        }}
                                                                        className="px-3 py-1 text-xs border border-[#0160C9]/40 text-[#0160C9] rounded-md hover:bg-[#0160C9]/5 font-bold"
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setDeleteConfirm(course.code)}
                                                                        className="px-3 py-1 text-xs border border-red-300 text-red-700 rounded-md hover:bg-red-50 font-medium"
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        {filteredCourses.length === 0 && (
                                            <div className="p-8 text-center text-gray-500">
                                                No courses found matching your filters.
                                            </div>
                                        )}
                                    </div>
                                </>
                            )
                        }
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdminDashboard;
