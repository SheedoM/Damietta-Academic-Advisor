/**
 * StudentProfileView Component
 * 
 * Displays full student profile with computed academic data,
 * passed courses table, roadmap generation, plan approval, and ticket history.
 */

import { useState } from 'react';
import { StudentProfile, ApprovedPlan } from '../types/student';
import { Ticket, getTicketsByStudentId } from '../types/ticket';
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
    const [planSemester, setPlanSemester] = useState('Fall 2026');
    const [planTerm, setPlanTerm] = useState<Term>(1);

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
        const result = generateRoadmap(studentForRoadmap, planTerm, courses);
        const codes = result.roadmap.map(c => c.code);
        setRoadmap(codes);
        setRoadmapCredits(result.roadmap.reduce((sum, c) => sum + c.credits, 0));
    };

    const handleApprovePlan = () => {
        if (!roadmap || roadmap.length === 0) return;
        const plan: ApprovedPlan = {
            courses: roadmap,
            credits: roadmapCredits,
            semester: planSemester,
            approvedAt: new Date().toISOString(),
        };
        updateStudent({ ...currentStudent, approvedPlan: plan });
        onUpdated();
    };

    const handleSaveEditedPlan = (selectedCourses: string[]) => {
        const credits = selectedCourses.reduce((sum, code) => {
            const c = courseLookup(code);
            return sum + (c?.credits || 0);
        }, 0);
        setRoadmap(selectedCourses);
        setRoadmapCredits(credits);
        setShowPlanEditor(false);
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
                initialSelectedCourses={roadmap || []}
                onSave={handleSaveEditedPlan}
                onCancel={() => setShowPlanEditor(false)}
            />
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-gray-900">{currentStudent.name}</h2>
                            {currentStudent.isBlocked && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">Blocked</span>
                            )}
                            {gpa < 2.0 && (
                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold border border-yellow-200">Academic Observation</span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500">
                            University ID: <span className="font-mono font-medium text-indigo-600">{currentStudent.universityId}</span>
                            {' • '}National ID: {currentStudent.nationalId} • Major: {currentStudent.major}
                            {currentStudent.isTransfer && (
                                <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                                    Transfer from {currentStudent.previousUniversity}
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                toggleBlock(currentStudent.nationalId);
                            }}
                            className={`px-3 py-1.5 text-sm rounded-md font-medium ${currentStudent.isBlocked
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
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
                            className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                        >
                            🎫 Tickets ({getTicketsByStudentId(currentStudent.universityId).length})
                        </button>
                        <button
                            onClick={() => setShowEditForm(true)}
                            className="px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200"
                        >
                            Edit
                        </button>
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200"
                        >
                            Delete
                        </button>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl ml-2">×</button>
                    </div>
                </div>

                {/* Academic Summary Cards */}
                <div className="grid grid-cols-4 gap-4 mb-6">
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
                        <p className="text-3xl font-bold text-purple-700">{currentStudent.passedCourses.length}</p>
                        <p className="text-xs text-purple-500 mt-1">{currentStudent.passedCourses.filter(c => c.grade !== 'Fail').length} passed</p>
                        <p className="text-xs text-gray-400">Courses</p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-6">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 font-medium">Progress to Graduation</span>
                        <span className="text-gray-500">{progressPercent}%</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${progressPercent >= 75 ? 'bg-green-500' :
                                progressPercent >= 50 ? 'bg-blue-500' :
                                    progressPercent >= 25 ? 'bg-indigo-500' :
                                        'bg-indigo-400'
                                }`}
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                {/* Passed Courses Table */}
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Passed Courses ({currentStudent.passedCourses.length})</h3>
                    {currentStudent.passedCourses.length > 0 ? (
                        <div className="border rounded-md overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
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
                                            <tr key={record.courseCode} className="hover:bg-gray-50">
                                                <td className="px-4 py-2 text-sm font-mono font-medium">
                                                    {record.courseCode}
                                                    {record.isTransferred && (
                                                        <span className="ml-1 text-xs bg-orange-100 text-orange-700 px-1 rounded">T</span>
                                                    )}
                                                    {record.isRepeated && (
                                                        <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1 rounded" title="Repeated course">R</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-600">{course?.name || 'Unknown'}</td>
                                                <td className="px-4 py-2 text-sm text-gray-500">{course?.credits || '-'}</td>
                                                <td className="px-4 py-2">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${gradeColor}`}>
                                                        {record.grade}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-500">{record.gradePoints.toFixed(1)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400 text-sm border rounded-md">
                            No courses registered yet.
                        </div>
                    )}
                </div>

                {/* Approved Plan (if exists) */}
                {currentStudent.approvedPlan && (
                    <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-green-800">✅ Approved Plan — {currentStudent.approvedPlan.semester}</h3>
                            <span className="text-xs text-green-600">
                                Approved {new Date(currentStudent.approvedPlan.approvedAt).toLocaleDateString()}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {currentStudent.approvedPlan.courses.map(code => {
                                const course = courseLookup(code);
                                return (
                                    <span key={code} className="px-2 py-1 bg-white rounded border border-green-200 text-sm">
                                        <span className="font-mono font-medium">{code}</span>
                                        {course && <span className="text-gray-500 ml-1">({course.credits}cr)</span>}
                                    </span>
                                );
                            })}
                        </div>
                        <p className="text-xs text-green-600 mt-2">
                            Total: {currentStudent.approvedPlan.credits} credit hours • {currentStudent.approvedPlan.courses.length} courses
                        </p>
                    </div>
                )}

                {/* Generate & Approve Plan */}
                <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <h3 className="text-sm font-semibold text-indigo-800 mb-3">📋 Semester Plan</h3>
                    <div className="flex flex-wrap items-end gap-3 mb-3">
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">Semester</label>
                            <input
                                type="text"
                                value={planSemester}
                                onChange={e => setPlanSemester(e.target.value)}
                                className="border rounded-md px-3 py-1.5 text-sm w-40"
                                placeholder="e.g., Fall 2026"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">Term</label>
                            <select
                                value={planTerm}
                                onChange={e => setPlanTerm(Number(e.target.value) as Term)}
                                className="border rounded-md px-3 py-1.5 text-sm"
                            >
                                <option value={1}>Fall (T1)</option>
                                <option value={2}>Spring (T2)</option>
                            </select>
                        </div>
                        <button
                            onClick={handleGenerateRoadmap}
                            className="px-4 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium text-sm"
                        >
                            🗺️ Generate Plan
                        </button>
                    </div>

                    {roadmap && (
                        <div className="mt-3">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-semibold text-indigo-800">
                                    Recommended ({roadmap.length} courses • {roadmapCredits} credits)
                                </h4>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowPlanEditor(true)}
                                        className="px-3 py-1 text-xs bg-indigo-200 text-indigo-800 rounded hover:bg-indigo-300 font-medium"
                                    >
                                        ✏️ Edit Plan
                                    </button>
                                    <button
                                        onClick={handleApprovePlan}
                                        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 font-medium"
                                    >
                                        ✅ Approve Plan
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {roadmap.map(code => {
                                    const course = courseLookup(code);
                                    return (
                                        <span key={code} className="px-2 py-1 bg-white rounded border border-indigo-200 text-sm">
                                            <span className="font-mono font-medium">{code}</span>
                                            {course && <span className="text-gray-500 ml-1">({course.credits}cr)</span>}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Ticket History */}
                {showTicketHistory && (
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Ticket History</h3>
                        {ticketHistory.length > 0 ? (
                            <div className="space-y-2">
                                {ticketHistory.map(ticket => (
                                    <div key={ticket.id} className="border rounded-md p-3 hover:bg-gray-50">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className="font-mono text-sm font-medium text-indigo-600">{ticket.id}</span>
                                                <span className="text-xs text-gray-400 ml-2">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ticket.status === 'resolved' ? 'bg-green-100 text-green-700' :
                                                ticket.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-gray-100 text-gray-700'
                                                }`}>
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
                            <div className="text-center py-4 text-gray-400 text-sm border rounded-md">
                                No tickets found for this student.
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
                <div className="flex justify-end pt-4 border-t">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border rounded-md hover:bg-gray-50"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
