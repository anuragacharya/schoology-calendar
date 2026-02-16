export interface IcsImportResult {
  success: boolean;
  fileName: string;
  courseId: string;
  courseName: string;
  eventsImported: number;
  errors: ImportError[];
  warnings: string[];
}

export interface ImportError {
  line?: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}
