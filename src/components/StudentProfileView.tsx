/**
 * StudentProfileView Component
 * 
 * Displays full student profile with computed academic data,
 * passed courses table, roadmap generation, plan approval, and ticket history.
 */

import { useState } from 'react';
import { StudentProfile, StudentPlan } from '../types/student';
import { Ticket, getTicketsByStudentId, updateTicketStatus } from '../types/ticket';
import { useCourses } from '../context/CourseContext';
import { useStudents } from '../context/StudentContext';
import { calculateGPA, calculatePassedHours, inferAcademicLevel, getGPAClassification, toStudentForRoadmap } from '../lib/gradeUtils';
import { generateRoadmap } from '../lib/roadmapLogic';
import { Major, Term } from '../types';
import { StudentForm } from './StudentForm';
import { StudentPlanEditor } from './StudentPlanEditor';

interface StudentProfileViewProps {
    student: StudentProfile;
    onClose: () => void;
    onDeleted: () => void;
    onUpdated: () => void;
}

export function StudentProfileView({ student, onClose, onDeleted, onUpdated }: StudentProfileViewProps) {
    const { courses } = useCourses();
    const { removeStudent, getStudent, toggleBlock, updateStudent } = useStudents();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [roadmap, setRoadmap] = useState<string[] | null>(null);
    const [roadmapCredits, setRoadmapCredits] = useState(0);
    const [showTicketHistory, setShowTicketHistory] = useState(false);
    const [ticketHistory, setTicketHistory] = useState<Ticket[]>([]);
    const [showPlanEditor, setShowPlanEditor] = useState(false);
    const [editingPlan, setEditingPlan] = useState<StudentPlan | null>(null);
    const [planSemester, setPlanSemester] = useState('Fall 2026');
    const [replyText, setReplyText] = useState<Record<string, string>>({});

    // Use fresh student data from context
    const currentStudent = getStudent(student.nationalId) || student;

    const courseLookup = (code: string) => courses.find(c => c.code === code);

    // Computed values
    const gpa = calculateGPA(currentStudent.passedCourses, courseLookup);
    const passedHours = calculatePassedHours(currentStudent.passedCourses, courseLookup);
    const level = inferAcademicLevel(passedHours);
    const classification = getGPAClassification(gpa);

    // Progress toward graduation (assume ~144 total hours)
    const totalHoursForGraduation = 144;
    const progressPercent = Math.min(100, Math.round((passedHours / totalHoursForGraduation) * 100));

    const handleGenerateRoadmap = () => {
        const studentForRoadmap = toStudentForRoadmap(currentStudent, courseLookup);
        const inferredTerm: Term = planSemester.toLowerCase().includes('spring') ? 2 : 1;
        const result = generateRoadmap(studentForRoadmap, inferredTerm, courses);
        const codes = result.roadmap.map(c => c.code);
        setRoadmap(codes);
        setRoadmapCredits(result.roadmap.reduce((sum, c) => sum + c.credits, 0));
        setEditingPlan(null); // Clear editing plan just in case
    };

    const handleApprovePlan = () => {
        if (!roadmap || roadmap.length === 0) return;
        const existingPlans = currentStudent.plans || [];
        // Remove existing plan for this semester
        const filteredPlans = existingPlans.filter(p => p.semester !== planSemester);

        const newPlan: StudentPlan = {
            id: `plan-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            semester: planSemester,
            status: 'approved',
            courses: roadmap,
            credits: roadmapCredits,
            generatedAt: new Date().toISOString(),
            approvedAt: new Date().toISOString(),
        };

        updateStudent({ ...currentStudent, plans: [...filteredPlans, newPlan] });
        setRoadmap(null);
        setRoadmapCredits(0);
        onUpdated();
    };

    const handleApproveDraft = (plan: StudentPlan) => {
        if (!currentStudent.plans) return;
        const updatedPlans = currentStudent.plans.map(p => {
            if (p.id === plan.id) {
                return { ...p, status: 'approved' as const, approvedAt: new Date().toISOString() };
            }
            return p;
        });
        updateStudent({ ...currentStudent, plans: updatedPlans });
        onUpdated();
    };

    const handleSaveEditedPlan = (selectedCourses: string[]) => {
        const credits = selectedCourses.reduce((sum, code) => {
            const c = courseLookup(code);
            return sum + (c?.credits || 0);
        }, 0);

        if (editingPlan) {
            const updatedPlans = (currentStudent.plans || []).map(p => {
                if (p.id === editingPlan.id) {
                    return { ...p, courses: selectedCourses, credits };
                }
                return p;
            });
            updateStudent({ ...currentStudent, plans: updatedPlans });
            setEditingPlan(null);
        } else {
            setRoadmap(selectedCourses);
            setRoadmapCredits(credits);
        }
        setShowPlanEditor(false);
    };

    const handleResolveTicket = (ticketId: string) => {
        const reply = replyText[ticketId];
        const updated = updateTicketStatus(ticketId, 'resolved', reply?.trim() || undefined);
        if (updated) {
            setTicketHistory(ticketHistory.map(t => t.id === ticketId ? updated : t));
            setReplyText(prev => ({ ...prev, [ticketId]: '' }));
        }
    };

    const handleDelete = () => {
        removeStudent(currentStudent.nationalId);
        onDeleted();
    };

    if (showEditForm) {
        return (
            <StudentForm
                existingStudent={currentStudent}
                onClose={() => setShowEditForm(false)}
                onSaved={() => {
                    setShowEditForm(false);
                    onUpdated();
                }}
            />
        );
    }

    if (showPlanEditor) {
        return (
            <StudentPlanEditor
                studentId={currentStudent.universityId}
                studentMajor={currentStudent.major as Major}
                passedCourses={currentStudent.passedCourses.filter(c => c.grade !== 'Fail').map(c => c.courseCode)}
                initialSelectedCourses={editingPlan ? editingPlan.courses : (roadmap || [])}
                onSave={handleSaveEditedPlan}
                onCancel={() => {
                    setShowPlanEditor(false);
                    setEditingPlan(null);
                }}
            />
        );
    }

    return (
        <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden m-4 border border-gray-100 flex flex-col">
                {/* Header */}
                <div className="sticky top-0 bg-white z-10 px-6 py-5 border-b border-gray-100 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">{currentStudent.name}</h2>
                            {currentStudent.isBlocked && (
                                <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold uppercase tracking-wider">Blocked</span>
                            )}
                            {gpa < 2.0 && (
                                <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-lg text-xs font-bold border border-yellow-200 uppercase tracking-wider">Academic Observation</span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 font-medium">
                            ID: <span className="font-mono text-university">{currentStudent.universityId}</span>
                            <span className="mx-2 text-gray-300">•</span>NID: {currentStudent.nationalId}
                            <span className="mx-2 text-gray-300">•</span>Major: {currentStudent.major}
                            {currentStudent.isTransfer && (
                                <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                                    Transfer from {currentStudent.previousUniversity}
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="flex gap-2.5">
                        <button
                            onClick={() => {
                                toggleBlock(currentStudent.nationalId);
                            }}
                            className={`px-4 py-2 text-sm rounded-xl font-semibold transition shadow-sm ${currentStudent.isBlocked
                                ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                                : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                                }`}
                        >
                            {currentStudent.isBlocked ? 'Unblock' : 'Block'}
                        </button>
                        <button
                            onClick={() => {
                                const history = getTicketsByStudentId(currentStudent.universityId);
                                setTicketHistory(history);
                                setShowTicketHistory(!showTicketHistory);
                            }}
                            className="px-4 py-2 text-sm bg-university-50 text-university-700 border border-university-200 rounded-xl font-semibold hover:bg-university-100 transition shadow-sm flex items-center gap-1"
                        >
                            <span>🎫</span> Tickets ({getTicketsByStudentId(currentStudent.universityId).length})
                        </button>
                        <button
                            onClick={() => setShowEditForm(true)}
                            className="px-4 py-2 text-sm bg-gray-50 text-gray-700 border border-gray-200 rounded-xl font-semibold hover:bg-gray-100 transition shadow-sm"
                        >
                            Edit
                        </button>
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="px-4 py-2 text-sm bg-red-50 text-red-700 border border-red-200 rounded-xl font-semibold hover:bg-red-100 transition shadow-sm"
                        >
                            Delete
                        </button>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-900 text-2xl ml-2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition duration-150">→</button>
                    </div>
                </div>

                {/* Content Body */}
                <div className="p-6 space-y-8">
                    {/* Academic Summary Cards */}
                    <div className="grid grid-cols-4 gap-5">
                        <div className="bg-university/5 p-5 rounded-2xl border border-university/10 flex flex-col items-center justify-center shadow-sm">
                            <p className="text-4xl font-extrabold text-university tracking-tight">{gpa.toFixed(2)}</p>
                            <p className="text-sm font-semibold text-university-600 mt-1">{classification}</p>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mt-2">Cumulative GPA</p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 flex flex-col items-center justify-center shadow-sm">
                            <p className="text-4xl font-extrabold text-gray-900 tracking-tight">{passedHours}</p>
                            <p className="text-sm font-semibold text-gray-500 mt-1">of ~{totalHoursForGraduation}h required</p>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mt-2">Passed Hours</p>
                        </div>
                        <div className="bg-green-50/50 p-5 rounded-2xl border border-green-100 flex flex-col items-center justify-center shadow-sm">
                            <p className="text-4xl font-extrabold text-green-700 tracking-tight">{level}</p>
                            <p className="text-sm font-semibold text-green-600 mt-1">Year {level}</p>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mt-2">Academic Level</p>
                        </div>
                        <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100 flex flex-col items-center justify-center shadow-sm">
                            <p className="text-4xl font-extrabold text-amber-600 tracking-tight">{currentStudent.passedCourses.length}</p>
                            <p className="text-sm font-semibold text-amber-600 mt-1">{currentStudent.passedCourses.filter(c => c.grade !== 'Fail').length} passed</p>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mt-2">Total Courses</p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-700 font-semibold">Degree Progress</span>
                            <span className="text-gray-500 font-medium">{progressPercent}%</span>
                        </div>
                        <div className="h-4 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ease-out bg-university`}
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>

                    {/* Passed Courses Table */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <span className="text-university">📚</span> Passed Courses <span className="text-sm font-medium text-gray-400 bg-gray-100 rounded-lg px-2 py-0.5 ml-2">{currentStudent.passedCourses.length}</span>
                        </h3>
                        {currentStudent.passedCourses.length > 0 ? (
                            <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                                <table className="min-w-full divide-y divide-gray-200 bg-white">
                                    <thead className="bg-gray-50/80">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Credits</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Points</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {currentStudent.passedCourses.map(record => {
                                            const course = courseLookup(record.courseCode);
                                            const gradeColor = record.grade === 'Excellent' ? 'text-green-700 bg-green-50' :
                                                record.grade === 'Very Good' ? 'text-blue-700 bg-blue-50' :
                                                    record.grade === 'Good' ? 'text-indigo-700 bg-indigo-50' :
                                                        record.grade === 'Pass' ? 'text-yellow-700 bg-yellow-50' :
                                                            'text-red-700 bg-red-50';
                                            return (
                                                <tr key={record.courseCode} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-800">
                                                        {record.courseCode}
                                                        {record.isTransferred && (
                                                            <span className="ml-1.5 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-md font-bold uppercase" title="Transferred">Tr</span>
                                                        )}
                                                        {record.isRepeated && (
                                                            <span className="ml-1.5 text-[10px] bg-university-100 text-university-700 px-1.5 py-0.5 rounded-md font-bold uppercase" title="Repeated course">Rp</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-600 font-medium">{course?.name || 'Unknown'}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-500 text-center">{course?.credits || '-'}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide ${gradeColor}`}>
                                                            {record.grade}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-500 text-center font-medium">{record.gradePoints.toFixed(1)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-10 bg-gray-50 border border-dashed border-gray-200 rounded-2xl">
                                <p className="text-sm text-gray-500 font-medium">No courses registered yet.</p>
                            </div>
                        )}
                    </div>

                    {/* Plan Management */}
                    <div className="p-5 bg-university/5 rounded-2xl border border-university/10 shadow-sm mt-8">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-university-900 flex items-center gap-2">
                                <span>�</span> Plan Management <span className="text-sm font-medium text-university-600 bg-white px-2 py-0.5 rounded-lg border border-university/20 ml-2">{(currentStudent.plans?.length || 0)} Records</span>
                            </h3>
                        </div>

                        {/* Existing Plans History */}
                        {(currentStudent.plans?.length || 0) > 0 && (
                            <div className="space-y-4 mb-8">
                                {currentStudent.plans!.sort((a, b) => b.semester.localeCompare(a.semester)).map(plan => {
                                    const isApproved = plan.status === 'approved';
                                    return (
                                        <div key={plan.id} className={`p-4 rounded-xl border shadow-sm relative overflow-hidden ${isApproved ? 'bg-green-50/90 border-green-200' : 'bg-amber-50/90 border-amber-200'}`}>
                                            <div className="flex items-center justify-between mb-3 relative z-10">
                                                <h4 className={`text-sm font-bold flex items-center gap-2 ${isApproved ? 'text-green-900' : 'text-amber-900'}`}>
                                                    <span className="text-lg">{isApproved ? '🎓' : '⏳'}</span>
                                                    {isApproved ? 'Approved Plan' : 'Draft Plan'}
                                                    <span className="opacity-50 mx-1">—</span> {plan.semester}
                                                </h4>
                                                <div className="flex gap-2 items-center">
                                                    <button
                                                        onClick={() => {
                                                            setEditingPlan(plan);
                                                            setPlanSemester(plan.semester);
                                                            setShowPlanEditor(true);
                                                        }}
                                                        className={`text-xs font-bold px-3 py-1 rounded-lg transition ${isApproved ? 'text-green-700 bg-green-200/50 hover:bg-green-300/50' : 'text-amber-700 bg-amber-200/50 hover:bg-amber-300/50'}`}
                                                    >
                                                        ✏️ Edit
                                                    </button>
                                                    {!isApproved && (
                                                        <button
                                                            onClick={() => handleApproveDraft(plan)}
                                                            className="text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1 rounded-lg transition shadow-sm"
                                                        >
                                                            ✓ Approve
                                                        </button>
                                                    )}
                                                    {isApproved && plan.approvedAt && (
                                                        <span className="text-[10px] bg-green-200/50 text-green-800 px-2 py-1 rounded-md font-bold uppercase tracking-wider ml-1">
                                                            {new Date(plan.approvedAt).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 relative z-10">
                                                {plan.courses.map(code => {
                                                    const course = courseLookup(code);
                                                    return (
                                                        <div key={code} className={`px-2 py-1 bg-white rounded-lg border shadow-sm flex items-center gap-1 ${isApproved ? 'border-green-100' : 'border-amber-200'}`}>
                                                            <span className="font-mono font-bold text-gray-800 text-xs">{code}</span>
                                                            {course && <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-1 py-0.5 rounded">{course.credits}cr</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className={`pt-5 ${(currentStudent.plans?.length || 0) > 0 ? 'border-t border-university/10' : ''}`}>
                            <h4 className="text-sm font-bold text-university-800 uppercase tracking-wider mb-4">Generate New Plan</h4>
                            <div className="flex flex-wrap items-end gap-4 mb-4">
                                <div className="flex-1 min-w-[250px]">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-university-800/80 mb-1.5 ml-1">Semester Target</label>
                                    <select
                                        value={planSemester}
                                        onChange={e => setPlanSemester(e.target.value)}
                                        className="w-full bg-white border border-university-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-university/40 focus:border-university outline-none transition-all cursor-pointer"
                                    >
                                        <option value="Fall 2026">Fall 2026</option>
                                        <option value="Spring 2027">Spring 2027</option>
                                        <option value="Fall 2027">Fall 2027</option>
                                        <option value="Spring 2028">Spring 2028</option>
                                        <option value="Fall 2028">Fall 2028</option>
                                        <option value="Spring 2029">Spring 2029</option>
                                    </select>
                                </div>
                                <button
                                    onClick={handleGenerateRoadmap}
                                    className="px-5 py-2.5 bg-university bg-[#0160C9] text-white rounded-xl hover:bg-blue-700 font-bold text-sm shadow-md shadow-[#0160C9]/20 transition-all flex items-center gap-2"
                                >
                                    <span>⚡</span> Auto-Generate Plan
                                </button>
                            </div>

                            {roadmap && (
                                <div className="mt-6 pt-5 border-t border-university/10 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
                                        <h4 className="text-base font-bold text-university-900">
                                            Suggested Roadmap <span className="text-sm font-medium text-university-600 bg-white px-2 py-0.5 rounded-lg border border-university/20 ml-2">{roadmap.length} courses • {roadmapCredits} credits</span>
                                        </h4>
                                        <div className="flex gap-2.5">
                                            <button
                                                onClick={() => setShowPlanEditor(true)}
                                                className="px-4 py-2 text-sm bg-white border border-university-200 text-university-700 rounded-xl hover:bg-university-50 font-semibold transition-all shadow-sm"
                                            >
                                                ✏️ Edit Plan
                                            </button>
                                            <button
                                                onClick={handleApprovePlan}
                                                className="px-5 py-2 text-sm bg-green-600 border border-green-700 text-white rounded-xl hover:bg-green-700 font-bold transition-all shadow-md flex items-center gap-1.5"
                                            >
                                                <span>✅</span> Save as Approved
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2.5">
                                        {roadmap.map(code => {
                                            const course = courseLookup(code);
                                            return (
                                                <div key={code} className="px-3 py-1.5 bg-white rounded-xl border border-university-100 shadow-sm flex items-center gap-1.5">
                                                    <span className="font-mono font-bold text-gray-800 text-sm">{code}</span>
                                                    {course && <span className="text-xs font-medium text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-md">{course.credits}cr</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Ticket History */}
                    {showTicketHistory && (
                        <div className="p-6 bg-gray-50 rounded-2xl border border-gray-200 shadow-sm">
                            <div className="flex justify-between items-center mb-5">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <span>🎫</span> Ticket History
                                </h3>
                                <span className="text-xs font-semibold bg-gray-200 text-gray-700 px-3 py-1 rounded-full">{ticketHistory.length} total</span>
                            </div>
                            {ticketHistory.length > 0 ? (
                                <div className="space-y-4">
                                    {ticketHistory.map(ticket => (
                                        <div key={ticket.id} className={`bg-white rounded-xl p-5 border shadow-sm transition-shadow ${ticket.status === 'open' ? 'border-university-200' : 'border-gray-200'}`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <span className="font-mono text-sm font-bold text-university">{ticket.id}</span>
                                                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${ticket.status === 'resolved' ? 'bg-green-100 text-green-700' :
                                                            ticket.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                                                                'bg-university-100 text-university-700 border border-university-200'
                                                            }`}>
                                                            {ticket.status === 'open' ? 'Open' : ticket.status === 'in_progress' ? 'In Progress' : 'Resolved'}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-medium text-gray-400">{new Date(ticket.createdAt).toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100 mt-2">
                                                <h4 className="text-sm font-bold text-gray-800">{ticket.subject}</h4>
                                                <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{ticket.message}</p>
                                                {ticket.attachmentName && (
                                                    <div className="mt-3 flex items-center gap-2">
                                                        <span className="text-xl">📎</span>
                                                        <span className="text-xs font-medium text-university-600 bg-university-50 px-2 py-1 rounded-lg border border-university-100">{ticket.attachmentName}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Resolution / Admin Reply Section */}
                                            {ticket.adminReply ? (
                                                <div className="mt-4 p-4 bg-university/5 rounded-xl border border-university/10 relative">
                                                    <div className="absolute -top-3 left-4 bg-university-50 text-university-700 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-university-100">Advisor Reply</div>
                                                    <p className="text-sm font-medium text-university-900 mt-1">{ticket.adminReply}</p>
                                                </div>
                                            ) : ticket.status !== 'resolved' ? (
                                                <div className="mt-4 pt-4 border-t border-gray-100">
                                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Resolve Ticket</label>
                                                    <div className="flex gap-2">
                                                        <textarea
                                                            value={replyText[ticket.id] || ''}
                                                            onChange={e => setReplyText(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                                                            placeholder="Type admin reply here..."
                                                            className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-university/40 focus:border-university outline-none transition-all resize-none h-10"
                                                        />
                                                        <button
                                                            onClick={() => handleResolveTicket(ticket.id)}
                                                            disabled={!replyText[ticket.id]?.trim()}
                                                            className="px-4 bg-university text-white rounded-xl font-bold text-sm shadow-sm hover:bg-university-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                        >
                                                            Resolve
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-10 bg-white border border-dashed border-gray-200 rounded-xl">
                                    <p className="text-sm text-gray-500 font-medium">No tickets found for this student.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Delete Confirmation */}
                    {showDeleteConfirm && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
                            <div className="bg-white rounded-lg p-6 max-w-sm">
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Student?</h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    Are you sure you want to delete <strong>{currentStudent.name}</strong>? This cannot be undone.
                                </p>
                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="px-4 py-2 border rounded-md hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Close Button */}
                    <div className="flex justify-end pt-4 border-t border-gray-100 mt-8">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all shadow-sm"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
