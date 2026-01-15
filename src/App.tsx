import { useState } from 'react'
import { generateRoadmap } from './lib/roadmapLogic'
import { Student, Course, Major } from './lib/types'
import { COURSES } from './data/courses'

function App() {
    const [jsonInput, setJsonInput] = useState<string>('');
    const [student, setStudent] = useState<Student>({
        major: 'CS',
        gpa: 2.0,
        passedCourses: [],
        passedHours: 0
    });
    const [currentTerm, setCurrentTerm] = useState<1 | 2 | 3>(1);
    const [roadmap, setRoadmap] = useState<Course[]>([]);
    const [logs, setLogs] = useState<string[]>([]);

    const handleGenerate = () => {
        // Basic Parsing of JSON input if provided, else use manual valid fields
        let currentStudent = { ...student };

        if (jsonInput.trim()) {
            try {
                const parsed = JSON.parse(jsonInput);
                // Expecting { passedCourses: string[], major: ..., gpa: ... }
                // Or if transcript format is different, adapt here.
                // For now, assuming user pastes a JSON matching our Student shape partially
                if (parsed.passedCourses) currentStudent.passedCourses = parsed.passedCourses;
                if (parsed.gpa) currentStudent.gpa = parsed.gpa;
                if (parsed.major) currentStudent.major = parsed.major;

                // Recalculate passed hours just in case
                const hours = currentStudent.passedCourses.reduce((sum, code) => {
                    const course = COURSES.find(c => c.code === code);
                    return sum + (course ? course.credits : 0);
                }, 0);
                currentStudent.passedHours = hours;

                setStudent(currentStudent);
            } catch (e) {
                alert("Invalid JSON");
                return;
            }
        }

        const { roadmap: result, log } = generateRoadmap(currentStudent, currentTerm);
        setRoadmap(result);
        setLogs(log);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Damietta University Advisor</h1>
                <p className="text-gray-600">Graduation Roadmap Generator</p>
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
                                placeholder='{"passedCourses": ["CS101", "Math101"], "gpa": 2.5}'
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

                    <div className="mt-8 border-t pt-4">
                        <h3 className="text-sm font-medium text-gray-500 mb-2">Generation Logs</h3>
                        <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded overflow-auto max-h-60">
                            {logs.join('\n')}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default App
