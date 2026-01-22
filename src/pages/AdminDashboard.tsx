import { COURSES } from '../data/courses'

function AdminDashboard() {
    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                    <p className="text-gray-600">Course Management</p>
                </div>
                <a href="/" className="text-blue-600 hover:underline">Back to Advisor</a>
            </header>

            <div className="bg-white rounded-lg shadowoverflow-hidden">
                <div className="p-4 border-b">
                    <h2 className="text-lg font-semibold">All Courses ({COURSES.length})</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-700 uppercase">
                            <tr>
                                <th className="px-6 py-3">Code</th>
                                <th className="px-6 py-3">Name</th>
                                <th className="px-6 py-3">Credits</th>
                                <th className="px-6 py-3">Term</th>
                                <th className="px-6 py-3">Prereqs</th>
                                <th className="px-6 py-3">Roles (CS/IS/IT)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {COURSES.map(course => (
                                <tr key={course.code} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium">{course.code}</td>
                                    <td className="px-6 py-4">{course.name}</td>
                                    <td className="px-6 py-4">{course.credits}</td>
                                    <td className="px-6 py-4">{course.term}</td>
                                    <td className="px-6 py-4">{course.prereqs.join(', ') || '-'}</td>
                                    <td className="px-6 py-4 text-xs">
                                        <div className="space-x-2">
                                            <span className="px-2 py-1 bg-blue-100 rounded text-blue-800">CS: {course.roles.CS}</span>
                                            <span className="px-2 py-1 bg-purple-100 rounded text-purple-800">IS: {course.roles.IS}</span>
                                            <span className="px-2 py-1 bg-green-100 rounded text-green-800">IT: {course.roles.IT}</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default AdminDashboard
