import { useMemo, useCallback, useState } from 'react';
import {
    ReactFlow,
    Controls,
    Background,
    applyNodeChanges,
    applyEdgeChanges,
    Node,
    Edge,
    NodeChange,
    EdgeChange,
    MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Course } from '../types';
import { StudentProfile } from '../types/student';
import { getCourseRoleInMajor, getCourseCategory } from '../data/courses';

interface PrerequisiteGraphProps {
    student: StudentProfile;
    allCourses: Course[];
}

export function PrerequisiteGraph({ student, allCourses }: PrerequisiteGraphProps) {
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);

    // Build the graph on mount / data change
    useMemo(() => {
        const passedCodes = new Set(
            student.passedCourses.filter(c => c.grade !== 'Fail').map(c => c.courseCode)
        );

        // 1. Filter courses relevant to the student
        const relevantCourses = allCourses.filter(course => {
            const cat = getCourseCategory(course.code);
            if (cat === 'university' || cat === 'college' || cat === 'basic_science' || course.code.startsWith('UNV') || course.code.startsWith('BS')) {
                return true;
            }

            if (student.major && student.major !== 'General') {
                const role = getCourseRoleInMajor(course.code, student.major as any);
                // Specifically including mandatory courses for the major as requested
                if (role === 'Mandatory') return true;
                // Also might include if they passed it anyway
                if (passedCodes.has(course.code)) return true;
            }

            return false;
        });

        // 2. Build map of course depth (max path length from root) to help with layout
        const codeToCourse = new Map<string, Course>();
        relevantCourses.forEach(c => codeToCourse.set(c.code, c));

        // A simple function to get prerequisite codes
        const getPrereqCodes = (c: Course): string[] => {
            return c.prereqs || [];
        };

        const courseDepth = new Map<string, number>();
        const getDepth = (code: string, visited = new Set<string>()): number => {
            if (courseDepth.has(code)) return courseDepth.get(code)!;
            if (visited.has(code)) return 0; // Avoid circular
            visited.add(code);

            const c = codeToCourse.get(code);
            if (!c) return 0;

            const prereqs = getPrereqCodes(c);
            if (prereqs.length === 0) {
                courseDepth.set(code, 0);
                return 0;
            }

            let maxPDepth = 0;
            for (const p of prereqs) {
                if (codeToCourse.has(p)) {
                    maxPDepth = Math.max(maxPDepth, getDepth(p, visited));
                }
            }

            const depth = maxPDepth + 1;
            courseDepth.set(code, depth);
            visited.delete(code);
            return depth;
        };

        relevantCourses.forEach(c => getDepth(c.code));

        // Group by depth
        const depthGroups = new Map<number, Course[]>();
        relevantCourses.forEach(c => {
            // If the course has a specified level, we can use it to augment depth, 
            // but purely connection-based is often better. Let's incorporate level as base if no prereqs
            let d = courseDepth.get(c.code) || 0;
            // We push it further right if its level is higher to keep it aligned
            if (d === 0) {
                d = (c.level || 1) - 1;
            } else {
                d = Math.max(d, (c.level || 1) - 1);
            }

            if (!depthGroups.has(d)) depthGroups.set(d, []);
            depthGroups.get(d)!.push(c);
        });

        // 3. Generate Nodes and Edges
        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];

        const nodeWidth = 200;
        const nodeHeight = 80;
        const xOffset = 280;
        const yOffset = 100;

        depthGroups.forEach((coursesAtDepth, depth) => {
            coursesAtDepth.forEach((course, index) => {
                // Status checks
                const isPassed = passedCodes.has(course.code);
                const prereqs = getPrereqCodes(course);
                const hasMissingPrereq = prereqs.some(p => !passedCodes.has(p));
                const isAvailable = !isPassed && !hasMissingPrereq;

                // Visual styling based on status
                let bgColor = '#f3f4f6'; // gray (locked)
                let borderColor = '#d1d5db';
                let textColor = '#6b7280';
                let statusText = 'Locked';

                if (isPassed) {
                    bgColor = '#dcfce7'; // green
                    borderColor = '#86efac';
                    textColor = '#166534';
                    statusText = 'Completed';
                } else if (isAvailable) {
                    bgColor = '#ffffff'; // white
                    borderColor = '#2563eb'; // university blue
                    textColor = '#1e3a8a';
                    statusText = 'Available';
                }

                const xPos = depth * xOffset + 50;
                const yPos = index * yOffset + 50;

                newNodes.push({
                    id: course.code,
                    position: { x: xPos, y: yPos },
                    data: {
                        label: (
                            <div className="flex flex-col h-full w-full">
                                <div className="font-bold text-sm mb-1">{course.code}</div>
                                <div className="text-[10px] truncate w-full" title={course.name}>{course.name}</div>
                                <div className="text-[9px] mt-autom uppercase tracking-widest font-bold opacity-80 mt-1">
                                    {course.credits}cr • {statusText}
                                </div>
                            </div>
                        )
                    },
                    style: {
                        width: nodeWidth,
                        height: nodeHeight,
                        background: bgColor,
                        border: `2px solid ${borderColor}`,
                        borderRadius: '8px',
                        color: textColor,
                        padding: '8px',
                        boxShadow: isAvailable ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                    },
                    sourcePosition: 'right' as any,
                    targetPosition: 'left' as any,
                });

                // Add Edges
                prereqs.forEach(p => {
                    if (codeToCourse.has(p)) {
                        newEdges.push({
                            id: `e-${p}-${course.code}`,
                            source: p,
                            target: course.code,
                            type: 'smoothstep',
                            animated: isAvailable && passedCodes.has(p), // Animate paths that are activating this course
                            style: {
                                stroke: isPassed ? '#22c55e' : isAvailable ? '#3b82f6' : '#cbd5e1',
                                strokeWidth: 2
                            },
                            markerEnd: {
                                type: MarkerType.ArrowClosed,
                                color: isPassed ? '#22c55e' : isAvailable ? '#3b82f6' : '#cbd5e1',
                            },
                        });
                    }
                });
            });
        });

        setNodes(newNodes);
        setEdges(newEdges);
    }, [student, allCourses]);

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
        []
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        []
    );

    return (
        <div className="w-full h-[600px] border border-gray-200 rounded-2xl overflow-hidden bg-gray-50/50">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                attributionPosition="bottom-right"
            >
                <Background gap={16} />
                <Controls />
            </ReactFlow>
        </div>
    );
}
