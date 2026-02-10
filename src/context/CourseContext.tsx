import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Course } from '../types';
import { COURSES as DEFAULT_COURSES } from '../data/courses';

const STORAGE_KEY = 'academic-advisor-courses';

interface CourseContextType {
    courses: Course[];
    addCourse: (course: Course) => void;
    updateCourse: (code: string, updates: Partial<Course>) => void;
    deleteCourse: (code: string) => void;
    toggleAvailability: (code: string) => void;
    resetToDefaults: () => void;
    exportCourses: () => void;
}

const CourseContext = createContext<CourseContextType | null>(null);

export function CourseProvider({ children }: { children: ReactNode }) {
    const [courses, setCourses] = useState<Course[]>(() => {
        // Load from localStorage on init, fallback to defaults
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch {
                return DEFAULT_COURSES.map(c => ({ ...c, available: true }));
            }
        }
        return DEFAULT_COURSES.map(c => ({ ...c, available: true }));
    });

    // Persist to localStorage on change
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
    }, [courses]);

    const addCourse = (course: Course) => {
        setCourses(prev => [...prev, { ...course, available: true }]);
    };

    const updateCourse = (code: string, updates: Partial<Course>) => {
        setCourses(prev =>
            prev.map(c => (c.code === code ? { ...c, ...updates } : c))
        );
    };

    const deleteCourse = (code: string) => {
        setCourses(prev => prev.filter(c => c.code !== code));
    };

    const toggleAvailability = (code: string) => {
        setCourses(prev =>
            prev.map(c =>
                c.code === code ? { ...c, available: !(c.available ?? true) } : c
            )
        );
    };

    const resetToDefaults = () => {
        const defaults = DEFAULT_COURSES.map(c => ({ ...c, available: true }));
        setCourses(defaults);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    };

    const exportCourses = () => {
        const dataStr = JSON.stringify(courses, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'courses.json';
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <CourseContext.Provider
            value={{
                courses,
                addCourse,
                updateCourse,
                deleteCourse,
                toggleAvailability,
                resetToDefaults,
                exportCourses,
            }}
        >
            {children}
        </CourseContext.Provider>
    );
}

export function useCourses() {
    const context = useContext(CourseContext);
    if (!context) {
        throw new Error('useCourses must be used within a CourseProvider');
    }
    return context;
}
