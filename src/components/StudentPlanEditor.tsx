import { useState, useMemo } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, GripVertical, Check, AlertCircle, Info, Link as LinkIcon, AlertTriangle } from 'lucide-react';

import { Course, Major } from '../types';
import { useCourses } from '../context/CourseContext';
import { getCourseRoleInMajor, inferLevelFromCode } from '../data/courses';

interface StudentPlanEditorProps {
    studentId: string;
    studentMajor: Major;
    passedCourses: string[];
    initialSelectedCourses?: string[];
    onSave: (selectedCourses: string[]) => void;
    onCancel: () => void;
}

// ----------------------------------------------------------------------
// Sortable Course Card Component (Selected Plan Area)
// ----------------------------------------------------------------------
function SortableCourseCard({
    course,
    role,
    missingPrereqs,
    onRemove
}: {
    course: Course;
    role: string;
    missingPrereqs: string[];
    onRemove: (id: string) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: course.code });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.4 : 1,
    };

    const hasError = missingPrereqs.length > 0;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative flex flex-col bg-white border rounded-xl shadow-sm ${isDragging ? 'shadow-lg border-university-400 ring-2 ring-university-200' :
                hasError ? 'border-red-200 bg-red-50/30' : 'border-gray-200 hover:border-university-200 hover:shadow-md'
                } transition-all group`}
        >
            <div className="flex items-center p-3">
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing p-1.5 -ml-2 text-gray-400 hover:text-university-500 transition-colors"
                    title="Drag to reorder"
                >
                    <GripVertical size={16} />
                </div>

                <div className="flex-1 min-w-0 ml-2">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono font-bold text-gray-900 text-sm tracking-tight">{course.code}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${role === 'Mandatory' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                            }`}>
                            {role === 'Mandatory' ? 'M' : 'E'}
                        </span>
                        <span className="text-xs font-semibold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                            {course.credits}cr
                        </span>
                    </div>
                    <div className="text-xs text-gray-600 truncate font-medium" title={course.name}>
                        {course.name}
                    </div>
                </div>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove(course.code);
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove course"
                >
                    <X size={16} />
                </button>
            </div>

            {hasError && (
                <div className="px-3 pb-3 pt-1">
                    <div className="bg-red-100 text-red-700 text-xs p-2 rounded-lg flex items-start gap-1.5 font-medium border border-red-200">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        <div>
                            <strong>Missing Prerequisites:</strong> {missingPrereqs.join(', ')}
                        </div>
                    </div>
                </div>
            )}

            {course.prereqs && course.prereqs.length > 0 && !hasError && (
                <div className="px-3 pb-2 pt-0">
                    <div className="flex items-center gap-1 text-[10px] font-medium text-gray-400 bg-gray-50 w-fit px-1.5 py-0.5 rounded border border-gray-100">
                        <LinkIcon size={10} />
                        <span>Requires: {course.prereqs.join(', ')}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ----------------------------------------------------------------------
// Available Course Card Component (Bank Area)
// ----------------------------------------------------------------------
function AvailableCourseCard({
    course,
    role,
    disabled,
    onAdd,
}: {
    course: Course;
    role: string;
    disabled?: boolean;
    onAdd: (id: string) => void;
}) {
    return (
        <div
            className={`relative flex items-center justify-between bg-white border rounded-xl p-3 transition-all ${disabled
                ? 'opacity-50 border-gray-200 bg-gray-50 grayscale-[0.5]'
                : 'border-gray-200 hover:border-university-300 hover:shadow-md cursor-pointer'
                }`}
            onClick={() => !disabled && onAdd(course.code)}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono font-bold text-gray-900 text-sm tracking-tight border-b-2 border-transparent">{course.code}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${role === 'Mandatory' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                        }`}>
                        {role === 'Mandatory' ? 'M' : 'E'}
                    </span>
                    <span className="text-xs font-semibold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                        {course.credits}cr
                    </span>
                </div>
                <div className="text-xs text-gray-500 truncate" title={course.name}>
                    {course.name}
                </div>
                {course.prereqs && course.prereqs.length > 0 && (
                    <div className="flex items-center gap-1 text-[10px] font-medium text-gray-400 mt-1">
                        <LinkIcon size={10} />
                        <span>Req: {course.prereqs.join(', ')}</span>
                    </div>
                )}
            </div>

            {!disabled && (
                <div className="flex-shrink-0 ml-3 text-university-600 bg-university-50 p-1.5 rounded-lg opacity-0 hover:bg-university-100 transition-all card-add-btn">
                    <span className="text-lg leading-none font-bold">+</span>
                </div>
            )}
            <style>{`
                div:hover > .card-add-btn { opacity: 1; }
            `}</style>
        </div>
    );
}


// ----------------------------------------------------------------------
// Main Editor Component
// ----------------------------------------------------------------------
export function StudentPlanEditor({
    studentId,
    studentMajor,
    passedCourses,
    initialSelectedCourses = [],
    onSave,
    onCancel
}: StudentPlanEditorProps) {
    const { courses } = useCourses();
    const [selectedCourses, setSelectedCourses] = useState<string[]>(initialSelectedCourses);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // 5px movement required before drag starts
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Filter out irrelevant or passed courses for the bank
    const availableCoursesPool = useMemo(() => {
        return courses.filter(course => {
            if (course.available === false) return false;

            const role = getCourseRoleInMajor(course.code, studentMajor);
            if (role === 'N/A') return false; // Not in major

            if (passedCourses.includes(course.code)) return false; // Already passed

            // Search filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                if (!course.code.toLowerCase().includes(term) && !course.name.toLowerCase().includes(term)) {
                    return false;
                }
            }

            return true;
        });
    }, [courses, studentMajor, passedCourses, searchTerm]);

    // Group available courses by level for the bank (excluding currently selected)
    const groupedAvailableCourses = useMemo(() => {
        const grouped: Record<number, Course[]> = { 1: [], 2: [], 3: [], 4: [] };

        availableCoursesPool.forEach(course => {
            // If it's already in the selected plan, skip it in the bank
            if (selectedCourses.includes(course.code)) return;

            const level = course.level || inferLevelFromCode(course.code);
            if (grouped[level]) {
                grouped[level].push(course);
            }
        });

        return grouped;
    }, [availableCoursesPool, selectedCourses]);

    // Check prerequisites for a given course
    // A prereq is met if it's in passedCourses.
    // (We do not count "co-requisites" from selectedCourses in this basic check).
    const getMissingPrereqs = (course: Course) => {
        if (!course.prereqs || course.prereqs.length === 0) return [];
        return course.prereqs.filter(prereq => !passedCourses.includes(prereq));
    };

    // Calculate plan statistics
    const planStats = useMemo(() => {
        const selectedObjects = selectedCourses.map(code => courses.find(c => c.code === code)).filter(Boolean) as Course[];
        const credits = selectedObjects.reduce((sum, c) => sum + (c.credits || 0), 0);

        // Ensure all prereqs are met to consider plan fully "valid"
        const hasPrereqErrors = selectedObjects.some(c => getMissingPrereqs(c).length > 0);

        return {
            credits,
            courses: selectedObjects,
            isValid: credits <= 19 && credits >= 9 && !hasPrereqErrors,
            isOverLimit: credits > 19,
            hasPrereqErrors
        };
    }, [selectedCourses, courses, passedCourses]);


    // Handlers
    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            setSelectedCourses((items) => {
                const oldIndex = items.indexOf(active.id);
                const newIndex = items.indexOf(over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleDragCancel = () => {
        setActiveId(null);
    };

    const addCourse = (code: string) => {
        if (!selectedCourses.includes(code)) {
            setSelectedCourses(prev => [...prev, code]);
        }
    };

    const removeCourse = (code: string) => {
        setSelectedCourses(prev => prev.filter(c => c !== code));
    };

    const activeCourseObj = activeId ? courses.find(c => c.code === activeId) : null;

    return (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 font-sans">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden border border-gray-200">

                {/* Header */}
                <div className="px-6 py-4 flex justify-between items-center bg-white border-b border-gray-100 z-10 shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                            <span className="text-university">🗓️</span> Draft Plan Editor
                        </h2>
                        <p className="text-sm text-gray-500 font-medium mt-1">
                            <span className="text-university-600 font-bold">{studentId}</span>
                            <span className="mx-2 px-1text-gray-300">•</span>
                            Major: <span className="font-semibold text-gray-700">{studentMajor}</span>
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onSave(selectedCourses)}
                            disabled={!planStats.isValid}
                            className={`px-5 py-2.5 text-sm font-bold text-white rounded-xl transition-all shadow-md flex items-center gap-2 ${!planStats.isValid
                                ? 'bg-gray-400 opacity-50 cursor-not-allowed shadow-none'
                                : 'bg-university hover:bg-university-600 shadow-university/20'
                                }`}
                        >
                            <Check size={18} />
                            Save Draft
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex overflow-hidden bg-gray-50/50">

                    {/* LEFT PANEL: Course Bank */}
                    <div className="w-1/2 flex flex-col border-r border-gray-200 bg-white z-0">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                                Course Bank
                            </h3>
                            <input
                                type="text"
                                placeholder="Search courses by code or name..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-university/40 focus:border-university transition-all shadow-sm"
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                            {[1, 2, 3, 4].map(level => {
                                const levelCourses = groupedAvailableCourses[level];
                                if (!levelCourses || levelCourses.length === 0) return null;

                                return (
                                    <div key={level} className="space-y-3">
                                        <h4 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest sticky top-0 bg-white py-1 z-10">
                                            <span>Level {level}</span>
                                            <div className="h-px bg-gray-100 flex-1"></div>
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            {levelCourses.map(course => (
                                                <AvailableCourseCard
                                                    key={course.code}
                                                    course={course}
                                                    role={getCourseRoleInMajor(course.code, studentMajor)}
                                                    onAdd={addCourse}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}

                            {Object.values(groupedAvailableCourses).every(arr => arr.length === 0) && (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3">
                                    <div className="bg-gray-100 p-4 rounded-full">
                                        <Info size={32} />
                                    </div>
                                    <p className="text-sm font-medium">No available courses match your search.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANEL: Selected Plan (Drag & Drop) */}
                    <div className="w-1/2 flex flex-col overflow-hidden bg-gray-50">
                        <div className="p-4 border-b border-gray-200 bg-white shadow-sm z-10">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                                    Selected Semester Plan
                                </h3>

                                <span className={`px-3 py-1 rounded-lg text-sm font-bold border flex items-center gap-1.5 ${planStats.isOverLimit
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : planStats.isValid
                                        ? 'bg-green-50 text-green-700 border-green-200'
                                        : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                    }`}>
                                    {planStats.isOverLimit && <AlertCircle size={14} />}
                                    {planStats.credits} / 19 Credits
                                </span>
                            </div>

                            {/* Validation Bar */}
                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mt-3">
                                <div
                                    className={`h-full transition-all duration-500 ease-out ${planStats.isOverLimit ? 'bg-red-500' : 'bg-university'
                                        }`}
                                    style={{ width: `${Math.min(100, (planStats.credits / 19) * 100)}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {selectedCourses.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl bg-white/50">
                                    <div className="bg-gray-100 p-4 rounded-full mb-4">
                                        <Info size={32} />
                                    </div>
                                    <p className="text-sm font-bold text-gray-600">Plan is empty</p>
                                    <p className="text-xs font-medium text-gray-400 mt-1 max-w-[250px] text-center">
                                        Click [+] on courses from the bank on the left to add them to this semester's plan.
                                    </p>
                                </div>
                            ) : (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragStart={handleDragStart}
                                    onDragEnd={handleDragEnd}
                                    onDragCancel={handleDragCancel}
                                >
                                    <div className="space-y-3">
                                        <SortableContext
                                            items={selectedCourses}
                                            strategy={rectSortingStrategy}
                                        >
                                            {selectedCourses.map((code) => {
                                                const course = planStats.courses.find(c => c.code === code);
                                                if (!course) return null;
                                                const missed = getMissingPrereqs(course);
                                                return (
                                                    <SortableCourseCard
                                                        key={course.code}
                                                        course={course}
                                                        role={getCourseRoleInMajor(course.code, studentMajor)}
                                                        missingPrereqs={missed}
                                                        onRemove={removeCourse}
                                                    />
                                                );
                                            })}
                                        </SortableContext>
                                    </div>

                                    {/* Drag Overlay for smooth animations */}
                                    <DragOverlay dropAnimation={{
                                        sideEffects: defaultDropAnimationSideEffects({
                                            styles: {
                                                active: { opacity: '0.4' }
                                            }
                                        })
                                    }}>
                                        {activeId && activeCourseObj ? (
                                            <div className="opacity-90 scale-105 rotate-2 shadow-xl cursor-grabbing">
                                                <SortableCourseCard
                                                    course={activeCourseObj}
                                                    role={getCourseRoleInMajor(activeId, studentMajor)}
                                                    missingPrereqs={getMissingPrereqs(activeCourseObj)}
                                                    onRemove={() => { }}
                                                />
                                            </div>
                                        ) : null}
                                    </DragOverlay>
                                </DndContext>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {/* Minimal custom scrollbar styles injected */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #e5e7eb;
                    border-radius: 10px;
                }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background-color: #d1d5db;
                }
            `}</style>
        </div>
    );
}

