import { useState, useMemo, useEffect } from 'react';
import { useCourses } from '../context/CourseContext';
import { Course, Major, MajorId, Term, CategoryType, CourseLevel } from '../types';
import { MAJORS, getCourseRoleInMajor, inferLevelFromCode, getCourseCategory, getCourseByCode } from '../data/courses';
import { StudentPlanEditor } from '../components/StudentPlanEditor';
import {
    getAllRequests,
    updateRequestStatus,
    updateRequestPlan,
    replyToTicket,
    StudentRequest,
    RequestStatus
} from '../types/request';


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

    // Auth state
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return sessionStorage.getItem('admin-auth') === 'true';
    });
    const [passwordInput, setPasswordInput] = useState('');
    const [authError, setAuthError] = useState('');

    const [mainTab, setMainTab] = useState<'courses' | 'requests'>('courses');
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

    // Request management state
    const [requests, setRequests] = useState<StudentRequest[]>([]);
    const [requestFilter, setRequestFilter] = useState<RequestStatus | 'all'>('all');
    const [selectedRequest, setSelectedRequest] = useState<StudentRequest | null>(null);
    const [ticketReply, setTicketReply] = useState('');
    const [adminNotes, setAdminNotes] = useState('');
    const [requestPlanEditorOpen, setRequestPlanEditorOpen] = useState(false);

    // Load requests on mount/tab change
    useEffect(() => {
        if (mainTab === 'requests') {
            setRequests(getAllRequests());
        }
    }, [mainTab]);

    const filteredRequests = useMemo(() => {
        if (requestFilter === 'all') return requests;
        return requests.filter(r => r.status === requestFilter);
    }, [requests, requestFilter]);

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

    const handleResolveRequest = () => {
        if (!selectedRequest) return;

        // Save reply if exists
        if (selectedRequest.ticket && ticketReply.trim()) {
            replyToTicket(selectedRequest.id, ticketReply);
        }

        // Update status and notes
        const updated = updateRequestStatus(selectedRequest.id, 'resolved', adminNotes);
        if (updated) {
            setRequests(requests.map(r => r.id === updated.id ? updated : r));
            setSelectedRequest(null);
        }
    };

    const handleSaveRequestPlan = (newPlan: string[]) => {
        if (!selectedRequest) return;

        // Calculate new credits
        const newCredits = newPlan.reduce((sum, code) => {
            const course = getCourseByCode(code);
            return sum + (course ? course.credits : 0);
        }, 0);

        const updated = updateRequestPlan(selectedRequest.id, newPlan, newCredits);
        if (updated) {
            setRequests(requests.map(r => r.id === updated.id ? updated : r));
            setSelectedRequest(updated); // Update selected to show new plan
            setRequestPlanEditorOpen(false);
        }
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
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
                <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <span className="text-2xl">🔒</span>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Admin Login</h1>
                        <p className="text-sm text-gray-500 mt-1">Enter the admin password to continue</p>
                    </div>
                    <div className="space-y-4">
                        <input
                            type="password"
                            value={passwordInput}
                            onChange={e => { setPasswordInput(e.target.value); setAuthError(''); }}
                            onKeyDown={e => e.key === 'Enter' && handleLogin()}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="Password"
                            autoFocus
                        />
                        {authError && <p className="text-sm text-red-600">{authError}</p>}
                        <button
                            onClick={handleLogin}
                            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
                        >
                            Sign In
                        </button>
                        <a href="/portal" className="block text-center text-sm text-gray-500 hover:text-gray-700">
                            ← Back to Student Portal
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <header className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                    <p className="text-gray-600">Course Management ({courses.length} courses)</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={exportCourses}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition text-sm"
                    >
                        Export JSON
                    </button>
                    <button
                        onClick={resetToDefaults}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition text-sm"
                    >
                        Reset to Defaults
                    </button>
                    <a href="/portal" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm">
                        Back to Portal
                    </a>
                    <button
                        onClick={handleLogout}
                        className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition text-sm"
                    >
                        Logout
                    </button>
                </div>
            </header>

            {/* Main Tabs - FIXED: proper Tailwind classes */}
            <div className="flex gap-4 mb-6 border-b">
                <button
                    onClick={() => setMainTab('courses')}
                    className={`px-4 py-2 font-medium transition border-b-2 -mb-px ${mainTab === 'courses'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Courses
                </button>

                <button
                    onClick={() => setMainTab('requests')}
                    className={`px-4 py-2 font-medium transition border-b-2 -mb-px ${mainTab === 'requests'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Requests ({requests.filter(r => r.status === 'pending').length} pending)
                </button>
            </div>

            {/* Requests Tab */}
            {mainTab === 'requests' && (
                <div className="space-y-6">
                    {/* Filters */}
                    <div className="flex gap-2">
                        {(['all', 'pending', 'in_progress', 'resolved'] as const).map(status => (
                            <button
                                key={status}
                                onClick={() => setRequestFilter(status)}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize ${requestFilter === status
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-700 border'
                                    }`}
                            >
                                {status.replace('_', ' ')}
                            </button>
                        ))}
                    </div>

                    {/* Request List */}
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Major</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredRequests.map(request => (
                                    <tr key={request.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{request.id}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {request.studentName}<br />
                                            <span className="text-xs text-gray-400">{request.studentId}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{request.major}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{request.planCredits} Cr</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {request.ticket ? (
                                                <span className="text-orange-600 font-medium">Yes</span>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                request.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-green-100 text-green-800'
                                                }`}>
                                                {request.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(request.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => {
                                                    setSelectedRequest(request);
                                                    setTicketReply(request.ticket?.adminReply || '');
                                                    setAdminNotes(request.adminNotes || '');
                                                    // Set status to in_progress if currently pending
                                                    if (request.status === 'pending') {
                                                        const updated = updateRequestStatus(request.id, 'in_progress');
                                                        if (updated) {
                                                            setRequests(requests.map(r => r.id === updated.id ? updated : r));
                                                        }
                                                    }
                                                }}
                                                className="text-indigo-600 hover:text-indigo-900"
                                            >
                                                Review
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredRequests.length === 0 && (
                            <div className="p-8 text-center text-gray-500">
                                No requests found.
                            </div>
                        )}
                    </div>

                    {/* Review Modal */}
                    {selectedRequest && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
                            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
                                <div className="flex justify-between items-start mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900">Review Request: {selectedRequest.id}</h2>
                                    <button
                                        onClick={() => setSelectedRequest(null)}
                                        className="text-gray-400 hover:text-gray-600 text-2xl"
                                    >×</button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        <h3 className="font-semibold text-gray-700 mb-2">Student Details</h3>
                                        <div className="space-y-1 text-sm mb-4">
                                            <p><span className="text-gray-500 w-20 inline-block">Name:</span> {selectedRequest.studentName}</p>
                                            <p><span className="text-gray-500 w-20 inline-block">ID:</span> {selectedRequest.studentId}</p>
                                            <p><span className="text-gray-500 w-20 inline-block">Major:</span> {selectedRequest.major}</p>
                                            <p><span className="text-gray-500 w-20 inline-block">Passed:</span> {selectedRequest.passedHours} hrs ({selectedRequest.passedCourses.length} courses)</p>
                                        </div>

                                        <h4 className="font-medium text-gray-700 text-xs uppercase tracking-wider mb-2">Progress by Category</h4>
                                        <div className="space-y-1 text-xs">
                                            {(() => {
                                                const breakdown: Record<string, number> = {};
                                                selectedRequest.passedCourses.forEach(code => {
                                                    const course = courses.find(c => c.code === code);
                                                    if (course && course.category) {
                                                        breakdown[course.category] = (breakdown[course.category] || 0) + course.credits;
                                                    }
                                                });
                                                return Object.entries(breakdown).map(([cat, hours]) => (
                                                    <div key={cat} className="flex justify-between">
                                                        <span className="text-gray-500 capitalize">{cat.replace('_requirements', '').replace('_', ' ')}</span>
                                                        <span className="font-medium">{hours} hrs</span>
                                                    </div>
                                                ));
                                            })()}
                                        </div>

                                        <div className="mt-4">
                                            <details className="text-xs">
                                                <summary className="cursor-pointer text-blue-600 hover:text-blue-800">View Passed Courses List</summary>
                                                <div className="mt-2 flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                                                    {selectedRequest.passedCourses.map(code => (
                                                        <span key={code} className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700">
                                                            {code}
                                                        </span>
                                                    ))}
                                                </div>
                                            </details>
                                        </div>
                                    </div>

                                    <div className="bg-indigo-50 p-4 rounded-lg">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-semibold text-indigo-800">Recommended Plan</h3>
                                            <button
                                                onClick={() => setRequestPlanEditorOpen(true)}
                                                className="text-xs bg-indigo-200 text-indigo-800 px-2 py-1 rounded hover:bg-indigo-300"
                                            >
                                                Edit Plan
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {selectedRequest.recommendedPlan.map(code => (
                                                <span key={code} className="px-2 py-0.5 bg-white rounded text-xs border border-indigo-100">
                                                    {code}
                                                </span>
                                            ))}
                                        </div>
                                        <p className="text-sm font-medium text-indigo-700">Total: {selectedRequest.planCredits} Cr</p>
                                    </div>
                                </div>

                                {selectedRequest.ticket && (
                                    <div className="mb-6 border rounded-lg overflow-hidden">
                                        <div className="bg-orange-50 p-3 border-b border-orange-100">
                                            <h3 className="font-semibold text-orange-800">Ticket: {selectedRequest.ticket.subject}</h3>
                                        </div>
                                        <div className="p-4">
                                            <p className="text-gray-700 mb-4">{selectedRequest.ticket.message}</p>

                                            <div className="mt-4">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Reply</label>
                                                <textarea
                                                    value={ticketReply}
                                                    onChange={e => setTicketReply(e.target.value)}
                                                    className="w-full border rounded-md p-2 text-sm"
                                                    rows={3}
                                                    placeholder="Write a reply to the student..."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes (Optional)</label>
                                    <textarea
                                        value={adminNotes}
                                        onChange={e => setAdminNotes(e.target.value)}
                                        className="w-full border rounded-md p-2 text-sm"
                                        rows={2}
                                        placeholder="Notes for other admins..."
                                    />
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t">
                                    <button
                                        onClick={() => setSelectedRequest(null)}
                                        className="px-4 py-2 border rounded-md hover:bg-gray-50"
                                    >
                                        Close
                                    </button>
                                    <button
                                        onClick={handleResolveRequest}
                                        className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                                    >
                                        Resolve Request
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Plan Editor Modal for Request */}
                    {requestPlanEditorOpen && selectedRequest && (
                        <StudentPlanEditor
                            studentId={selectedRequest.studentId}
                            studentMajor={selectedRequest.major as Major}
                            passedCourses={selectedRequest.passedCourses}
                            initialSelectedCourses={selectedRequest.recommendedPlan}
                            onSave={handleSaveRequestPlan}
                            onCancel={() => setRequestPlanEditorOpen(false)}
                        />
                    )}
                </div>
            )}



            {/* Courses Tab */}
            {mainTab === 'courses' && (
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
                                    ? 'bg-blue-600 text-white'
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
                                    ? 'bg-indigo-600 text-white'
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
                                        ? 'bg-indigo-600 text-white'
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
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
                        >
                            + Add Course
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
                                                <option value={1}>Fall</option>
                                                <option value={2}>Spring</option>
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
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
                                                <option value={1}>Fall</option>
                                                <option value={2}>Spring</option>
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
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
                                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${course.available !== false ? 'bg-indigo-600' : 'bg-gray-200'}`}
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
                                                        className="px-3 py-1 text-xs border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50 font-medium"
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
            )}
        </div>
    );
}

export default AdminDashboard;
