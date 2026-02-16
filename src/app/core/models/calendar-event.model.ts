export interface CalendarEvent {
  id: string;              // UUID from ICS UID
  title: string;           // Event summary
  description: string;     // Event details
  startDate: Date;         // Due date/start time
  endDate: Date;           // End time
  eventType: EventType;    // Assignment, Exam, Quiz, Project, Other
  courseId: string;        // FK to Course
  courseName: string;      // For quick access
  courseColor: string;     // Hex color for visual distinction
  location?: string;       // Optional location field
  status: EventStatus;     // Upcoming, Overdue, Completed
  isAllDay: boolean;       // Full-day event flag
  recurrence?: RecurrenceRule;  // For recurring events
  rawIcsData?: string;     // Original ICS component (for debugging)
}

export enum EventType {
  ASSIGNMENT = 'assignment',
  EXAM = 'exam',
  QUIZ = 'quiz',
  PROJECT = 'project',
  OTHER = 'other'
}

export enum EventStatus {
  UPCOMING = 'upcoming',
  OVERDUE = 'overdue',
  COMPLETED = 'completed'
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  until?: Date;
}
