import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { FileUploadService } from '../../core/services/file-upload.service';
import { IcsParserService } from '../../core/services/ics-parser.service';
import { EventManagerService } from '../../core/services/event-manager.service';
import { CalendarEvent } from '../../core/models/calendar-event.model';
import { Course } from '../../core/models/course.model';

interface ImportResult {
  fileName: string;
  success: boolean;
  courseName: string;
  eventsCount: number;
  error?: string;
}

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatChipsModule,
    MatSnackBarModule,
    MatDialogModule
  ],
  template: `
    <div class="import-container">
      <mat-card class="import-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>cloud_upload</mat-icon>
            Import Schoology Calendars
          </mat-card-title>
          <mat-card-subtitle>
            Drag & drop .ics files or click to browse
          </mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <!-- Drop Zone -->
          <div
            class="dropzone"
            [class.dragover]="isDragging"
            [class.disabled]="isProcessing"
            (drop)="onDrop($event)"
            (dragover)="onDragOver($event)"
            (dragleave)="onDragLeave($event)"
            (click)="fileInput.click()"
          >
            <mat-icon class="upload-icon">{{ isDragging ? 'file_download' : 'cloud_upload' }}</mat-icon>
            <h3>{{ isDragging ? 'Drop files here' : 'Click or drag files here' }}</h3>
            <p>Supported: .ics, .ical files (Max 5MB per file)</p>

            <input
              #fileInput
              type="file"
              multiple
              accept=".ics,.ical"
              (change)="onFileSelect($event)"
              style="display: none;"
            />
          </div>

          <!-- Selected Files -->
          <div *ngIf="selectedFiles.length > 0" class="selected-files">
            <h4>Selected Files ({{ selectedFiles.length }})</h4>
            <mat-chip-set>
              <mat-chip *ngFor="let file of selectedFiles" [removable]="!isProcessing" (removed)="removeFile(file)">
                {{ file.name }}
                <mat-icon matChipRemove *ngIf="!isProcessing">cancel</mat-icon>
              </mat-chip>
            </mat-chip-set>
          </div>

          <!-- Progress -->
          <div *ngIf="isProcessing" class="progress-section">
            <mat-progress-bar mode="determinate" [value]="progressPercent"></mat-progress-bar>
            <p class="progress-text">
              <strong>{{ progressPercent }}%</strong> - {{ getProgressMessage() }}
            </p>
          </div>

          <!-- Import Results -->
          <div *ngIf="importResults.length > 0" class="results-section">
            <h4>Import Results</h4>
            <div class="result-list">
              <div *ngFor="let result of importResults" class="result-item" [class.success]="result.success" [class.error]="!result.success">
                <mat-icon>{{ result.success ? 'check_circle' : 'error' }}</mat-icon>
                <div class="result-details">
                  <strong>{{ result.fileName }}</strong>
                  <span *ngIf="result.success">
                    {{ result.courseName }} - {{ result.eventsCount }} events imported
                  </span>
                  <span *ngIf="!result.success" class="error-message">
                    {{ result.error }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="actions">
            <button
              mat-raised-button
              color="primary"
              [disabled]="selectedFiles.length === 0 || isProcessing"
              (click)="processFiles()"
              class="action-button"
            >
              <mat-icon>upload</mat-icon>
              <span>Import {{ selectedFiles.length }} File(s)</span>
            </button>

            <button
              mat-raised-button
              *ngIf="hasSuccessfulImports()"
              (click)="viewCalendar()"
              class="action-button"
            >
              <mat-icon>calendar_month</mat-icon>
              <span>View Calendar</span>
            </button>

            <button
              mat-button
              *ngIf="selectedFiles.length > 0 && !isProcessing"
              (click)="clearAll()"
              class="action-button"
            >
              <span>Clear Files</span>
            </button>

            <button
              mat-button
              color="warn"
              (click)="clearDatabase()"
              class="action-button"
            >
              <mat-icon>delete_forever</mat-icon>
              <span>Clear All Data</span>
            </button>
          </div>

          <!-- Help Section -->
          <div class="help-section">
            <mat-icon>help_outline</mat-icon>
            <div class="help-text">
              <strong>How to export from Schoology:</strong>
              <ol>
                <li>Log into Schoology</li>
                <li>Go to each course calendar</li>
                <li>Click "Export" or calendar settings</li>
                <li>Download the .ics file</li>
                <li>Upload all files here</li>
              </ol>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .import-container {
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
    }

    .import-card {
      mat-card-header {
        margin-bottom: 24px;

        mat-card-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 24px;
        }
      }
    }

    .dropzone {
      border: 3px dashed #ccc;
      border-radius: 12px;
      padding: 60px 40px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
      background-color: #fafafa;

      &:hover:not(.disabled) {
        border-color: #3f51b5;
        background-color: #f5f5f5;
      }

      &.dragover {
        border-color: #3f51b5;
        background-color: #e8eaf6;
        transform: scale(1.02);
      }

      &.disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .upload-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #3f51b5;
        margin-bottom: 16px;
      }

      h3 {
        margin: 0 0 8px 0;
        color: #333;
      }

      p {
        margin: 0;
        color: #666;
        font-size: 14px;
      }
    }

    .selected-files {
      margin-top: 24px;

      h4 {
        margin-bottom: 12px;
        color: #333;
      }

      mat-chip-set {
        margin-top: 8px;
      }
    }

    .progress-section {
      margin-top: 24px;

      .progress-text {
        margin-top: 8px;
        text-align: center;
        color: #666;
      }
    }

    .results-section {
      margin-top: 32px;

      h4 {
        margin-bottom: 16px;
        color: #333;
      }

      .result-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .result-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px;
        border-radius: 8px;
        background-color: #f5f5f5;

        &.success {
          background-color: #e8f5e9;

          mat-icon {
            color: #4caf50;
          }
        }

        &.error {
          background-color: #ffebee;

          mat-icon {
            color: #f44336;
          }
        }

        .result-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;

          strong {
            color: #333;
          }

          span {
            font-size: 14px;
            color: #666;
          }

          .error-message {
            color: #d32f2f;
          }
        }
      }
    }

    .actions {
      margin-top: 32px;
      display: flex;
      gap: 16px;
      justify-content: center;
      flex-wrap: wrap;
      align-items: center;

      .action-button {
        min-width: 180px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 8px 24px;
        white-space: nowrap;

        mat-icon {
          margin: 0;
          font-size: 20px;
          width: 20px;
          height: 20px;
        }

        span {
          line-height: 1.5;
        }
      }
    }

    .help-section {
      margin-top: 32px;
      padding: 16px;
      background-color: #e3f2fd;
      border-radius: 8px;
      display: flex;
      gap: 16px;

      mat-icon {
        color: #1976d2;
        flex-shrink: 0;
      }

      .help-text {
        font-size: 14px;
        color: #333;

        strong {
          display: block;
          margin-bottom: 8px;
        }

        ol {
          margin: 0;
          padding-left: 20px;

          li {
            margin-bottom: 4px;
          }
        }
      }
    }
  `]
})
export class ImportComponent implements OnInit {
  selectedFiles: File[] = [];
  importResults: ImportResult[] = [];
  isDragging = false;
  isProcessing = false;
  progressPercent = 0;
  currentFileIndex = 0;

  constructor(
    private fileUploadService: FileUploadService,
    private icsParserService: IcsParserService,
    private eventManagerService: EventManagerService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {}

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.isProcessing) {
      this.isDragging = true;
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    if (this.isProcessing) return;

    const files = event.dataTransfer?.files;
    if (files) {
      this.handleFiles(Array.from(files));
    }
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleFiles(Array.from(input.files));
    }
  }

  handleFiles(files: File[]): void {
    // Validate files
    const validFiles: File[] = [];

    for (const file of files) {
      const validation = this.fileUploadService.validateIcsFile(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        this.snackBar.open(`${file.name}: ${validation.error}`, 'Close', {
          duration: 5000
        });
      }
    }

    if (validFiles.length > 0) {
      this.selectedFiles = [...this.selectedFiles, ...validFiles];
      this.snackBar.open(`${validFiles.length} file(s) added`, 'Close', {
        duration: 2000
      });
    }
  }

  removeFile(file: File): void {
    this.selectedFiles = this.selectedFiles.filter(f => f !== file);
  }

  clearAll(): void {
    this.selectedFiles = [];
    this.importResults = [];
    this.progressPercent = 0;
    this.currentFileIndex = 0;
  }

  async processFiles(): Promise<void> {
    if (this.selectedFiles.length === 0) return;

    // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.isProcessing = true;
      this.importResults = [];
      this.progressPercent = 0;
      this.currentFileIndex = 0;
    }, 0);

    // Wait a tick before proceeding
    await new Promise(resolve => setTimeout(resolve, 0));

    try {
      // Step 1: Parse all files in parallel (much faster!)
      this.progressPercent = 10;
      console.log('Starting to parse', this.selectedFiles.length, 'files...');

      const parsePromises = this.selectedFiles.map(async (file) => {
        try {
          console.log('Reading file:', file.name, 'Size:', file.size, 'bytes');
          const content = await this.fileUploadService.readIcsFile(file);
          console.log('File read complete:', file.name, 'Content length:', content.length);

          const courseName = this.icsParserService.extractCourseName(content, file.name);
          console.log('Course name extracted:', courseName);

          const courseId = this.eventManagerService.generateId();
          const courseColor = this.eventManagerService.generateRandomColor();

          console.log('Starting ICS parsing for:', file.name);
          const parseResult = this.icsParserService.parseIcsFile(
            content,
            courseId,
            courseName,
            courseColor,
            file.name
          );
          console.log('ICS parsing complete for:', file.name, 'Success:', parseResult.success);

          if (parseResult.success && (parseResult as any).events) {
            return {
              file,
              success: true,
              courseId,
              courseName,
              courseColor,
              events: (parseResult as any).events as CalendarEvent[],
              error: undefined
            };
          } else {
            return {
              file,
              success: false,
              error: parseResult.errors[0]?.message || 'Failed to parse ICS file'
            };
          }
        } catch (error) {
          return {
            file,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      const parsedResults = await Promise.all(parsePromises);
      this.progressPercent = 60;

      // Step 2: Batch database operations (saves time by doing all at once)
      const allCourses: Course[] = [];
      const allEvents: CalendarEvent[] = [];

      for (const result of parsedResults) {
        if (result.success && result.events) {
          // Prepare course
          const course: Course = {
            id: result.courseId!,
            name: result.courseName!,
            color: result.courseColor!,
            isActive: true,
            importedDate: new Date(),
            eventCount: result.events.length,
            icsFileName: result.file.name
          };
          allCourses.push(course);
          allEvents.push(...result.events);

          this.importResults.push({
            fileName: result.file.name,
            success: true,
            courseName: result.courseName!,
            eventsCount: result.events.length
          });
        } else {
          this.importResults.push({
            fileName: result.file.name,
            success: false,
            courseName: '',
            eventsCount: 0,
            error: result.error
          });
        }
      }

      this.progressPercent = 80;

      // Step 3: Save everything to database in one go
      if (allCourses.length > 0) {
        // Add all courses
        for (const course of allCourses) {
          await this.eventManagerService.addCourse(course);
        }

        // Add all events in bulk (single operation)
        await this.eventManagerService.addEvents(allEvents);
      }

      this.progressPercent = 100;

    } catch (error) {
      console.error('Import error:', error);
      setTimeout(() => {
        this.isProcessing = false;
      }, 0);
      this.snackBar.open(
        'Import failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
        'Close',
        { duration: 5000 }
      );
      return;
    }

    // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.isProcessing = false;
      this.progressPercent = 100;
      // Clear selected files so user can import again
      this.selectedFiles = [];

      const successCount = this.importResults.filter(r => r.success).length;
      const totalEvents = this.importResults.reduce((sum, r) => sum + r.eventsCount, 0);

      this.snackBar.open(
        `Import complete! ${successCount} file(s) processed, ${totalEvents} events added.`,
        'Close',
        { duration: 5000 }
      );
    }, 0);
  }

  viewCalendar(): void {
    this.router.navigate(['/calendar']);
  }

  hasSuccessfulImports(): boolean {
    return this.importResults.length > 0 && this.importResults.some(r => r.success);
  }

  getProgressMessage(): string {
    if (this.progressPercent < 10) {
      return 'Starting import...';
    } else if (this.progressPercent < 60) {
      return `Parsing ${this.selectedFiles.length} file(s) in parallel...`;
    } else if (this.progressPercent < 80) {
      return 'Processing events...';
    } else if (this.progressPercent < 100) {
      return 'Saving to database...';
    } else {
      return 'Complete!';
    }
  }

  async clearDatabase(): Promise<void> {
    const confirmed = confirm(
      'Are you sure you want to delete ALL courses and events? This cannot be undone!'
    );

    if (confirmed) {
      try {
        await this.eventManagerService.clearAllData();
        this.importResults = [];
        this.snackBar.open('All data cleared successfully!', 'Close', {
          duration: 3000
        });
      } catch (error) {
        this.snackBar.open(
          'Failed to clear data: ' + (error instanceof Error ? error.message : 'Unknown error'),
          'Close',
          { duration: 5000 }
        );
      }
    }
  }
}
