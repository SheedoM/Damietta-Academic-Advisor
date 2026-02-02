import { useState } from 'react';
import { generateRoadmap, BucketStatus } from '../lib/roadmapLogic';
import { Student, Course, Major } from '../types';
import { useCourses } from '../context/CourseContext';

function StudentDashboard() {
    const { courses } = useCourses();
    const [jsonInput, setJsonInput] = useState<string>('');
    const [student, setStudent] = useState<Student>({
        major: 'CS',
        gpa: 2.0,
        passedCourses: [],
        passedHours: 0,
    });
    const [currentTerm, setCurrentTerm] = useState<1 | 2 | 3>(1);
    const [roadmap, setRoadmap] = useState<Course[]>([]);
    const [logs, setLogs] = useState<string[]>([]);
    const [bucketStatuses, setBucketStatuses] = useState<BucketStatus[]>([]);

    const handleGenerate = () => {
        let currentStudent = { ...student };

        if (jsonInput.trim()) {
            try {
                const parsed = JSON.parse(jsonInput);
                if (parsed.passedCourses) currentStudent.passedCourses = parsed.passedCourses;
                if (parsed.gpa) currentStudent.gpa = parsed.gpa;
                if (parsed.major) currentStudent.major = parsed.major;

                // Recalculate passed hours
                const hours = currentStudent.passedCourses.reduce((sum: number, code: string) => {
                    const course = courses.find(c => c.code === code);
                    return sum + (course ? course.credits : 0);
                }, 0);
                currentStudent.passedHours = hours;

                setStudent(currentStudent);
            } catch {
                alert('Invalid JSON');
                return;
            }
        }

        // Filter out unavailable courses before generating roadmap
        const availableCourses = courses.filter(c => c.available !== false);
        const { roadmap: result, log, bucketStatuses: statuses } = generateRoadmap(currentStudent, currentTerm, availableCourses);
        setRoadmap(result);
        setLogs(log);
        setBucketStatuses(statuses);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Damietta University Advisor</h1>
                    <p className="text-gray-600">Graduation Roadmap Generator</p>
                </div>
                <a href="/admin" className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition text-sm">
                    Admin Dashboard
                </a>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Section */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4">Student Data</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Major</label>
                            <select
                                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                value={student.major}
                                onChange={e => setStudent({ ...student, major: e.target.value as Major })}
                            >
                                <option value="General">General Program (Years 1-2)</option>
                                <option value="CS">Computer Science</option>
                                <option value="IS">Information Systems</option>
                                <option value="IT">Information Technology</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">GPA</label>
                            <input
                                type="number"
                                step="0.01"
                                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                value={student.gpa}
                                onChange={e => setStudent({ ...student, gpa: parseFloat(e.target.value) })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Target Semester</label>
                            <select
                                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                value={currentTerm}
                                onChange={e => setCurrentTerm(parseInt(e.target.value) as 1 | 2 | 3)}
                            >
                                <option value={1}>Fall (Term 1)</option>
                                <option value={2}>Spring (Term 2)</option>
                                <option value={3}>Summer (Term 3)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Passed Courses JSON (Optional)</label>
                            <textarea
                                className="mt-1 block w-full border border-gray-300 rounded-md p-2 h-32 font-mono text-xs"
                                placeholder='{"passedCourses": ["CS101", "BS101"], "gpa": 2.5}'
                                value={jsonInput}
                                onChange={e => setJsonInput(e.target.value)}
                            />
                        </div>

                        <button
                            onClick={handleGenerate}
                            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
                        >
                            Generate Roadmap
                        </button>
                    </div>
                </div>

                {/* Results Section */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4">Recommended Roadmap</h2>

                    <div className="mb-4 p-4 bg-blue-50 rounded-md">
                        <p className="text-sm text-blue-800">
                            Total Credits: <span className="font-bold">{roadmap.reduce((sum, c) => sum + c.credits, 0)}</span>
                        </p>
                    </div>

                    {roadmap.length === 0 ? (
                        <p className="text-gray-500 italic">No courses generated yet.</p>
                    ) : (
                        <ul className="space-y-3">
                            {roadmap.map(course => (
                                <li key={course.code} className="border border-gray-200 rounded-md p-3 flex justify-between items-center bg-white hover:shadow-sm">
                                    <div>
                                        <div className="font-medium text-gray-900">{course.code}: {course.name}</div>
                                        <div className="text-xs text-gray-500">Prereqs: {course.prereqs.join(', ') || 'None'}</div>
                                    </div>
                                    <div className="text-sm font-semibold bg-gray-100 px-2 py-1 rounded">
                                        {course.credits} Cr
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* Category Progress Section */}
                    {bucketStatuses.length > 0 && (
                        <div className="mt-6 border-t pt-4">
                            <h3 className="text-lg font-semibold text-gray-800 mb-3">Category Progress</h3>
                            <div className="space-y-3">
                                {bucketStatuses
                                    .filter(bucket => bucket.required < 900)
                                    .map(bucket => {
                                        const total = bucket.passed + bucket.planned;
                                        const remaining = Math.max(0, bucket.required - total);
                                        const progressPercent = Math.min(100, (total / bucket.required) * 100);
                                        const isComplete = total >= bucket.required;

                                        return (
                                            <div key={bucket.name} className="bg-gray-50 rounded-lg p-3">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-sm font-medium text-gray-700">{bucket.name}</span>
                                                    <span className={`text-sm font-semibold ${isComplete ? 'text-green-600' : 'text-gray-600'}`}>
                                                        {remaining === 0 ? '✓ Complete' : `${remaining} hrs remaining`}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                                                        <div
                                                            className={`h-2.5 rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${progressPercent}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-xs text-gray-500 whitespace-nowrap">
                                                        {total}/{bucket.required} hrs
                                                    </span>
                                                </div>
                                                {bucket.planned > 0 && (
                                                    <div className="text-xs text-gray-400 mt-1">
                                                        ({bucket.passed} passed + {bucket.planned} planned this semester)
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                    <div className="mt-8 border-t pt-4">
                        <h3 className="text-sm font-medium text-gray-500 mb-2">Generation Logs</h3>
                        <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded overflow-auto max-h-60">
                            {logs.join('\n')}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default StudentDashboard;
