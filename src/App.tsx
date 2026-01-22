import { BrowserRouter, Routes, Route } from 'react-router-dom'
import StudentDashboard from './pages/StudentDashboard'
import AdminDashboard from './pages/AdminDashboard'

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<StudentDashboard />} />
                <Route path="/admin" element={<AdminDashboard />} />
            </Routes>
        </BrowserRouter>
    )
}

export default App
