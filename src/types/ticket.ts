/**
 * Ticket System Types & Storage
 * 
 * Replaces the old request.ts. Tickets are support requests from students
 * (subject, message, optional file attachment). Plans are managed separately
 * via StudentProfile.approvedPlan.
 */

export type TicketStatus = 'open' | 'in_progress' | 'resolved';

export interface Ticket {
    id: string;              // Tracking number (e.g., TKT-20260305-ABCD)
    studentId: string;       // University ID
    studentName: string;
    subject: string;
    message: string;
    attachmentName?: string;   // Original filename
    attachmentData?: string;   // Base64-encoded data URL
    adminReply?: string;
    status: TicketStatus;
    createdAt: string;
    resolvedAt?: string;
}

/**
 * Generate a unique ticket tracking number.
 */
export function generateTicketNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TKT-${date}-${random}`;
}

// ============ localStorage CRUD ============

const STORAGE_KEY = 'student_tickets';

export function saveTicket(ticket: Ticket): void {
    const tickets = getAllTickets();
    const index = tickets.findIndex(t => t.id === ticket.id);
    if (index >= 0) {
        tickets[index] = ticket;
    } else {
        tickets.push(ticket);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

export function getAllTickets(): Ticket[] {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export function getTicketById(id: string): Ticket | undefined {
    return getAllTickets().find(t => t.id === id);
}

export function getTicketsByStudentId(studentId: string): Ticket[] {
    return getAllTickets()
        .filter(t => t.studentId === studentId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function updateTicketStatus(id: string, status: TicketStatus, adminReply?: string): Ticket | null {
    const tickets = getAllTickets();
    const index = tickets.findIndex(t => t.id === id);
    if (index >= 0) {
        tickets[index].status = status;
        if (adminReply !== undefined) tickets[index].adminReply = adminReply;
        if (status === 'resolved') tickets[index].resolvedAt = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
        return tickets[index];
    }
    return null;
}
