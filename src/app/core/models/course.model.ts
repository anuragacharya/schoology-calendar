export interface Course {
  id: string;              // Generated UUID
  name: string;            // Extracted from ICS file or user input
  color: string;           // Auto-assigned or user-selected (hex color)
  isActive: boolean;       // For filtering (show/hide course in calendar)
  importedDate: Date;      // When ICS was imported
  eventCount: number;      // Number of events in this course
  icsFileName: string;     // Original file name for reference
}
