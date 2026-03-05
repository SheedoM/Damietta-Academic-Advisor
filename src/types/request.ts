/**
 * Student Request System Types
 */

export type RequestStatus = 'pending' | 'in_progress' | 'resolved';

export interface TicketData {
    subject: string;
    message: string;
    adminReply?: string;
}

export interface StudentRequest {
    id: string;              // Tracking number (e.g., REQ-20260209-ABCD)
    studentId: string;
    studentName: string;
    major: string;
    passedCourses: string[];
    passedHours: number;
    recommendedPlan: string[];  // Course codes for next semester
    planCredits: number;
    ticket?: TicketData;
    transcriptFileName?: string;   // Original PDF filename
    transcriptFileData?: string;   // Base64-encoded PDF data URL
    status: RequestStatus;
    adminNotes?: string;
    createdAt: string;
    resolvedAt?: string;
}

/**
 * Generate a unique tracking number
 */
export function generateTrackingNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `REQ-${date}-${random}`;
}

/**
 * Request storage utilities (localStorage-based for now)
 */
const STORAGE_KEY = 'student_requests';

export function saveRequest(request: StudentRequest): void {
    const requests = getAllRequests();
    const index = requests.findIndex(r => r.id === request.id);
    if (index >= 0) {
        requests[index] = request;
    } else {
        requests.push(request);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

export function getAllRequests(): StudentRequest[] {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export function getRequestById(id: string): StudentRequest | undefined {
    return getAllRequests().find(r => r.id === id);
}

/**
 * Get all requests for a given student ID (University ID), sorted by createdAt descending.
 */
export function getRequestsByStudentId(studentId: string): StudentRequest[] {
    return getAllRequests()
        .filter(r => r.studentId === studentId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function updateRequestStatus(id: string, status: RequestStatus, adminNotes?: string): StudentRequest | null {
    const requests = getAllRequests();
    const index = requests.findIndex(r => r.id === id);
    if (index >= 0) {
        requests[index].status = status;
        if (adminNotes !== undefined) requests[index].adminNotes = adminNotes;
        if (status === 'resolved') requests[index].resolvedAt = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
        return requests[index];
    }
    return null;
}

export function updateRequestPlan(id: string, recommendedPlan: string[], planCredits: number): StudentRequest | null {
    const requests = getAllRequests();
    const index = requests.findIndex(r => r.id === id);
    if (index >= 0) {
        requests[index].recommendedPlan = recommendedPlan;
        requests[index].planCredits = planCredits;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
        return requests[index];
    }
    return null;
}

export function replyToTicket(id: string, reply: string): StudentRequest | null {
    const requests = getAllRequests();
    const index = requests.findIndex(r => r.id === id);
    if (index >= 0 && requests[index].ticket) {
        requests[index].ticket!.adminReply = reply;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
        return requests[index];
    }
    return null;
}
