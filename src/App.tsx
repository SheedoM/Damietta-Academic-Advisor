import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CourseProvider } from './context/CourseContext';
import { StudentProvider } from './context/StudentContext';
import { LanguageProvider } from './context/LanguageContext';
import AdminDashboard from './pages/AdminDashboard';
import StudentPortal from './pages/StudentPortal';

function App() {
    return (
        <LanguageProvider>
            <CourseProvider>
                <StudentProvider>
                    <BrowserRouter>
                        <Routes>
                            <Route path="/" element={<StudentPortal />} />
                            <Route path="/portal" element={<StudentPortal />} />
                            <Route path="/admin" element={<AdminDashboard />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </BrowserRouter>
                </StudentProvider>
            </CourseProvider>
        </LanguageProvider>
    );
}

export default App;
