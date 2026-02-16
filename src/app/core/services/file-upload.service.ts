import { Injectable } from '@angular/core';
import { ValidationResult } from '../models/ics-import-result.model';

/**
 * File Upload Service
 * Handles file validation, reading, and upload processing for ICS files
 */
@Injectable({
  providedIn: 'root'
})
export class FileUploadService {

  // Configuration
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_EXTENSIONS = ['.ics', '.ical'];
  private readonly ALLOWED_MIME_TYPES = ['text/calendar', 'application/ics', ''];

  constructor() {}

  /**
   * Validate ICS file
   * Checks file extension, size, and MIME type
   */
  validateIcsFile(file: File): ValidationResult {
    // Check file extension
    const ext = this.getFileExtension(file.name);
    if (!this.ALLOWED_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        error: `Invalid file type. Only .ics or .ical files are allowed. Got: ${ext}`
      };
    }

    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const maxSizeMB = (this.MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
      return {
        valid: false,
        error: `File size (${sizeMB}MB) exceeds the maximum allowed size of ${maxSizeMB}MB`
      };
    }

    // Check if file is empty
    if (file.size === 0) {
      return {
        valid: false,
        error: 'File is empty'
      };
    }

    // Check MIME type (if available)
    if (file.type && !this.ALLOWED_MIME_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: `Invalid MIME type: ${file.type}. Expected: ${this.ALLOWED_MIME_TYPES.join(', ')}`
      };
    }

    return { valid: true };
  }

  /**
   * Read ICS file content as text
   * Returns a Promise that resolves with the file content
   */
  async readIcsFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const result = event.target?.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Failed to read file as text'));
        }
      };

      reader.onerror = () => {
        reject(new Error(`File read error: ${reader.error?.message || 'Unknown error'}`));
      };

      reader.onabort = () => {
        reject(new Error('File reading was aborted'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Validate and read multiple ICS files
   * Returns an array of results for each file
   */
  async processMultipleFiles(files: FileList | File[]): Promise<{
    file: File;
    content?: string;
    error?: string;
  }[]> {
    const fileArray = Array.from(files);
    const results = [];

    for (const file of fileArray) {
      const validation = this.validateIcsFile(file);

      if (!validation.valid) {
        results.push({
          file,
          error: validation.error
        });
        continue;
      }

      try {
        const content = await this.readIcsFile(file);
        results.push({
          file,
          content
        });
      } catch (error) {
        results.push({
          file,
          error: error instanceof Error ? error.message : 'Unknown error reading file'
        });
      }
    }

    return results;
  }

  /**
   * Extract file name without extension
   */
  getFileNameWithoutExtension(fileName: string): string {
    return fileName.replace(/\.[^/.]+$/, '');
  }

  /**
   * Get file extension (lowercase, with dot)
   */
  private getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot === -1) return '';
    return fileName.substring(lastDot).toLowerCase();
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Check if file is a valid ICS file by checking its extension
   */
  isIcsFile(fileName: string): boolean {
    const ext = this.getFileExtension(fileName);
    return this.ALLOWED_EXTENSIONS.includes(ext);
  }

  /**
   * Get a list of allowed file extensions for display
   */
  getAllowedExtensions(): string[] {
    return [...this.ALLOWED_EXTENSIONS];
  }

  /**
   * Get max file size in MB for display
   */
  getMaxFileSizeMB(): number {
    return this.MAX_FILE_SIZE / (1024 * 1024);
  }
}
