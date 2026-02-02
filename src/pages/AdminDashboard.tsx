import { useState, useMemo } from 'react';
import { useCourses } from '../context/CourseContext';
import { Course, Term, RoleStatus } from '../types';

type CategoryFilter = 'all' | 'university' | 'basic-science' | 'college' | 'major' | 'projects';

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
    all: 'All Courses',
    university: 'University',
    'basic-science': 'Basic Science',
    college: 'College',
    major: 'Major',
    projects: 'Projects & Training',
};

// Helper to categorize courses by prefix
function getCourseCategory(code: string): CategoryFilter {
    if (code.startsWith('UNV')) return 'university';
    if (code.startsWith('BS')) return 'basic-science';
    if (code.startsWith('TR') || code.startsWith('PR')) return 'projects';
    // CS, IS, IT are either college or major based on roles (simplified: all go to major)
    return 'major';
}

const EMPTY_COURSE: Omit<Course, 'code'> & { code: string } = {
    code: '',
    name: '',
    credits: 3,
    prereqs: [],
    term: 1 as Term,
    roles: { CS: 'Elective', IS: 'Elective', IT: 'Elective' },
    available: true,
};

function AdminDashboard() {
    const { courses, addCourse, updateCourse, deleteCourse, toggleAvailability, resetToDefaults, exportCourses } = useCourses();
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
    const [editingCourse, setEditingCourse] = useState<Course | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newCourse, setNewCourse] = useState<Course>(EMPTY_COURSE as Course);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter courses
    const filteredCourses = useMemo(() => {
        let result = courses;

        // Category filter
        if (categoryFilter !== 'all') {
            result = result.filter(c => getCourseCategory(c.code) === categoryFilter);
        }

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                c => c.code.toLowerCase().includes(query) || c.name.toLowerCase().includes(query)
            );
        }

        return result;
    }, [courses, categoryFilter, searchQuery]);

    const handleSaveEdit = () => {
        if (editingCourse) {
            updateCourse(editingCourse.code, editingCourse);
            setEditingCourse(null);
        }
    };

    const handleCreateCourse = () => {
        if (!newCourse.code.trim() || !newCourse.name.trim()) {
            alert('Code and Name are required');
            return;
        }
        if (courses.some(c => c.code === newCourse.code)) {
            alert('Course code already exists');
            return;
        }
        addCourse(newCourse);
        setNewCourse(EMPTY_COURSE as Course);
        setIsCreating(false);
    };

    const handleDeleteConfirm = (code: string) => {
        deleteCourse(code);
        setDeleteConfirm(null);
    };

    const RoleSelect = ({ value, onChange }: { value: RoleStatus; onChange: (v: RoleStatus) => void }) => (
        <select
            value={value}
            onChange={e => onChange(e.target.value as RoleStatus)}
            className="border rounded px-1 py-0.5 text-xs w-20"
        >
            <option value="Mandatory">Mandatory</option>
            <option value="Elective">Elective</option>
            <option value="N/A">N/A</option>
        </select>
    );

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
                    <a href="/" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm">
                        Back to Advisor
                    </a>
                </div>
            </header>

            {/* Category Tabs */}
            <div className="flex gap-2 mb-4 flex-wrap">
                {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map(cat => (
                    <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${categoryFilter === cat
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-50 border'
                            }`}
                    >
                        {CATEGORY_LABELS[cat]}
                    </button>
                ))}
            </div>

            {/* Search & Add */}
            <div className="flex gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Search courses..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="flex-1 border rounded-md px-4 py-2"
                />
                <button
                    onClick={() => setIsCreating(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
                >
                    + Add Course
                </button>
            </div>

            {/* Create Course Modal */}
            {isCreating && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-auto">
                        <h2 className="text-xl font-bold mb-4">Add New Course</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium">Code *</label>
                                    <input
                                        type="text"
                                        value={newCourse.code}
                                        onChange={e => setNewCourse({ ...newCourse, code: e.target.value.toUpperCase() })}
                                        className="w-full border rounded px-3 py-2 mt-1"
                                        placeholder="CS101"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Credits *</label>
                                    <input
                                        type="number"
                                        value={newCourse.credits}
                                        onChange={e => setNewCourse({ ...newCourse, credits: parseInt(e.target.value) || 0 })}
                                        className="w-full border rounded px-3 py-2 mt-1"
                                        min={1}
                                        max={6}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Name *</label>
                                <input
                                    type="text"
                                    value={newCourse.name}
                                    onChange={e => setNewCourse({ ...newCourse, name: e.target.value })}
                                    className="w-full border rounded px-3 py-2 mt-1"
                                    placeholder="Course Name"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium">Term</label>
                                    <select
                                        value={newCourse.term}
                                        onChange={e => setNewCourse({ ...newCourse, term: parseInt(e.target.value) as Term })}
                                        className="w-full border rounded px-3 py-2 mt-1"
                                    >
                                        <option value={1}>Fall (Term 1)</option>
                                        <option value={2}>Spring (Term 2)</option>
                                        <option value={3}>Summer (Term 3)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Prerequisites</label>
                                    <input
                                        type="text"
                                        value={newCourse.prereqs.join(', ')}
                                        onChange={e => setNewCourse({ ...newCourse, prereqs: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                        className="w-full border rounded px-3 py-2 mt-1"
                                        placeholder="CS101, BS102"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Roles per Major</label>
                                <div className="flex gap-4">
                                    <div>
                                        <label className="text-xs text-gray-500">CS</label>
                                        <RoleSelect value={newCourse.roles.CS} onChange={v => setNewCourse({ ...newCourse, roles: { ...newCourse.roles, CS: v } })} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500">IS</label>
                                        <RoleSelect value={newCourse.roles.IS} onChange={v => setNewCourse({ ...newCourse, roles: { ...newCourse.roles, IS: v } })} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500">IT</label>
                                        <RoleSelect value={newCourse.roles.IT} onChange={v => setNewCourse({ ...newCourse, roles: { ...newCourse.roles, IT: v } })} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6 justify-end">
                            <button onClick={() => { setIsCreating(false); setNewCourse(EMPTY_COURSE as Course); }} className="px-4 py-2 border rounded-md hover:bg-gray-50">
                                Cancel
                            </button>
                            <button onClick={handleCreateCourse} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                                Create Course
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-sm">
                        <h2 className="text-lg font-bold mb-2">Delete Course?</h2>
                        <p className="text-gray-600 mb-4">Are you sure you want to delete <strong>{deleteConfirm}</strong>? This cannot be undone.</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border rounded-md hover:bg-gray-50">
                                Cancel
                            </button>
                            <button onClick={() => handleDeleteConfirm(deleteConfirm)} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Courses Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3 w-12">Active</th>
                                <th className="px-4 py-3">Code</th>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Credits</th>
                                <th className="px-4 py-3">Term</th>
                                <th className="px-4 py-3">Prereqs</th>
                                <th className="px-4 py-3">Roles (CS/IS/IT)</th>
                                <th className="px-4 py-3 w-32">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredCourses.map(course => {
                                const isEditing = editingCourse?.code === course.code;
                                const isUnavailable = course.available === false;

                                return (
                                    <tr key={course.code} className={`hover:bg-gray-50 ${isUnavailable ? 'opacity-50 bg-gray-100' : ''}`}>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => toggleAvailability(course.code)}
                                                className={`w-10 h-5 rounded-full transition relative ${isUnavailable ? 'bg-gray-300' : 'bg-green-500'}`}
                                            >
                                                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${isUnavailable ? 'left-0.5' : 'left-5'}`} />
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 font-medium">{course.code}</td>
                                        <td className="px-4 py-3">
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={editingCourse.name}
                                                    onChange={e => setEditingCourse({ ...editingCourse, name: e.target.value })}
                                                    className="border rounded px-2 py-1 w-full"
                                                />
                                            ) : (
                                                course.name
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={editingCourse.credits}
                                                    onChange={e => setEditingCourse({ ...editingCourse, credits: parseInt(e.target.value) || 0 })}
                                                    className="border rounded px-2 py-1 w-16"
                                                    min={1}
                                                    max={6}
                                                />
                                            ) : (
                                                course.credits
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {isEditing ? (
                                                <select
                                                    value={editingCourse.term}
                                                    onChange={e => setEditingCourse({ ...editingCourse, term: parseInt(e.target.value) as Term })}
                                                    className="border rounded px-2 py-1"
                                                >
                                                    <option value={1}>1</option>
                                                    <option value={2}>2</option>
                                                    <option value={3}>3</option>
                                                </select>
                                            ) : (
                                                course.term
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={editingCourse.prereqs.join(', ')}
                                                    onChange={e => setEditingCourse({ ...editingCourse, prereqs: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                                    className="border rounded px-2 py-1 w-full"
                                                />
                                            ) : (
                                                course.prereqs.join(', ') || '-'
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {isEditing ? (
                                                <div className="flex gap-1">
                                                    <RoleSelect value={editingCourse.roles.CS} onChange={v => setEditingCourse({ ...editingCourse, roles: { ...editingCourse.roles, CS: v } })} />
                                                    <RoleSelect value={editingCourse.roles.IS} onChange={v => setEditingCourse({ ...editingCourse, roles: { ...editingCourse.roles, IS: v } })} />
                                                    <RoleSelect value={editingCourse.roles.IT} onChange={v => setEditingCourse({ ...editingCourse, roles: { ...editingCourse.roles, IT: v } })} />
                                                </div>
                                            ) : (
                                                <div className="flex gap-1 text-xs">
                                                    <span className="px-1.5 py-0.5 bg-blue-100 rounded text-blue-800">{course.roles.CS}</span>
                                                    <span className="px-1.5 py-0.5 bg-purple-100 rounded text-purple-800">{course.roles.IS}</span>
                                                    <span className="px-1.5 py-0.5 bg-green-100 rounded text-green-800">{course.roles.IT}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {isEditing ? (
                                                <div className="flex gap-1">
                                                    <button onClick={handleSaveEdit} className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                                                        Save
                                                    </button>
                                                    <button onClick={() => setEditingCourse(null)} className="px-2 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500">
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-1">
                                                    <button onClick={() => setEditingCourse({ ...course })} className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                                                        Edit
                                                    </button>
                                                    <button onClick={() => setDeleteConfirm(course.code)} className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">
                                                        Delete
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredCourses.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        No courses found matching your filters.
                    </div>
                )}
            </div>
        </div>
    );
}

export default AdminDashboard;
