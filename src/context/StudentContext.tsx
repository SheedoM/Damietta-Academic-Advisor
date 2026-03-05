/**
 * Student Context
 * 
 * React Context for student profile state management.
 * Mirrors the CourseContext pattern with localStorage persistence.
 */

import { createContext, useContext, useState, ReactNode } from 'react';
import {
    StudentProfile,
    getAllStudents,
    saveStudent as saveStudentToStorage,
    deleteStudent as deleteStudentFromStorage,
    studentExists,
    getStudentByUniversityId as getStudentByUniIdFromStorage,
} from '../types/student';

interface StudentContextType {
    students: StudentProfile[];
    addStudent: (student: StudentProfile) => boolean; // returns false if duplicate nationalId
    updateStudent: (student: StudentProfile) => void;
    removeStudent: (nationalId: string) => void;
    getStudent: (nationalId: string) => StudentProfile | undefined;
    getStudentByUniversityId: (universityId: string) => StudentProfile | undefined;
    toggleBlock: (nationalId: string) => void;
    refreshStudents: () => void;
}

const StudentContext = createContext<StudentContextType | null>(null);

export function StudentProvider({ children }: { children: ReactNode }) {
    const [students, setStudents] = useState<StudentProfile[]>(() => getAllStudents());

    // Sync state with localStorage
    const refreshStudents = () => {
        setStudents(getAllStudents());
    };

    const addStudent = (student: StudentProfile): boolean => {
        // Check for duplicate national ID
        if (studentExists(student.nationalId)) {
            return false;
        }
        const now = new Date().toISOString();
        const newStudent: StudentProfile = {
            ...student,
            createdAt: now,
            updatedAt: now,
        };
        saveStudentToStorage(newStudent);
        setStudents(prev => [...prev, newStudent]);
        return true;
    };

    const updateStudent = (student: StudentProfile) => {
        const updated = { ...student, updatedAt: new Date().toISOString() };
        saveStudentToStorage(updated);
        setStudents(prev =>
            prev.map(s => s.nationalId === student.nationalId ? updated : s)
        );
    };

    const removeStudent = (nationalId: string) => {
        deleteStudentFromStorage(nationalId);
        setStudents(prev => prev.filter(s => s.nationalId !== nationalId));
    };

    const getStudent = (nationalId: string): StudentProfile | undefined => {
        return students.find(s => s.nationalId === nationalId);
    };

    const getStudentByUniversityId = (universityId: string): StudentProfile | undefined => {
        // Check in-memory first, fallback to storage
        return students.find(s => s.universityId === universityId) || getStudentByUniIdFromStorage(universityId);
    };

    const toggleBlock = (nationalId: string) => {
        const student = students.find(s => s.nationalId === nationalId);
        if (student) {
            const updated = { ...student, isBlocked: !student.isBlocked, updatedAt: new Date().toISOString() };
            saveStudentToStorage(updated);
            setStudents(prev => prev.map(s => s.nationalId === nationalId ? updated : s));
        }
    };

    return (
        <StudentContext.Provider
            value={{
                students,
                addStudent,
                updateStudent,
                removeStudent,
                getStudent,
                getStudentByUniversityId,
                toggleBlock,
                refreshStudents,
            }}
        >
            {children}
        </StudentContext.Provider>
    );
}

export function useStudents() {
    const context = useContext(StudentContext);
    if (!context) {
        throw new Error('useStudents must be used within a StudentProvider');
    }
    return context;
}
