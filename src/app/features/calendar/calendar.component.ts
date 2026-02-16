import { Component, OnInit, OnDestroy, ViewChild, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventManagerService } from '../../core/services/event-manager.service';
import { CalendarEvent } from '../../core/models/calendar-event.model';
import { Course } from '../../core/models/course.model';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatCardModule,
    MatButtonToggleModule,
    MatBadgeModule,
    MatDialogModule,
    FullCalendarModule
  ],
  template: `
    <div class="calendar-container">
      <!-- Toolbar -->
      <mat-toolbar color="primary" class="calendar-toolbar">
        <h1>
          <mat-icon>calendar_month</mat-icon>
          Schoology Calendar
        </h1>
        <span class="spacer"></span>

        <button mat-icon-button (click)="goToImport()">
          <mat-icon [matBadge]="totalEvents()" matBadgeColor="accent">upload</mat-icon>
        </button>
      </mat-toolbar>

      <!-- Main Content -->
      <div class="content">
        <!-- Sidebar -->
        <div class="sidebar">
          <mat-card>
            <mat-card-header>
              <mat-card-title>Courses</mat-card-title>
              <mat-card-subtitle>{{ (courses$ | async)?.length || 0 }} courses</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <div class="course-filters">
                <div class="filter-actions">
                  <button mat-button (click)="showAllCourses()" size="small" class="filter-button">
                    <mat-icon>visibility</mat-icon>
                    <span>Show All</span>
                  </button>
                  <button mat-button (click)="hideAllCourses()" size="small" class="filter-button">
                    <mat-icon>visibility_off</mat-icon>
                    <span>Hide All</span>
                  </button>
                </div>

                <mat-chip-listbox class="course-chips" multiple>
                  <mat-chip-option
                    *ngFor="let course of courses$ | async"
                    [selected]="isActiveCourse(course.id)"
                    (click)="toggleCourse(course.id)"
                    [style.--chip-color]="course.color"
                    class="course-chip"
                  >
                    <span class="chip-dot" [style.background-color]="course.color"></span>
                    {{ course.name }}
                    <mat-icon matChipTrailingIcon [matBadge]="course.eventCount" matBadgeSize="small">
                      event
                    </mat-icon>
                  </mat-chip-option>
                </mat-chip-listbox>

                <div *ngIf="(courses$ | async)?.length === 0" class="empty-state">
                  <mat-icon>folder_open</mat-icon>
                  <p>No courses imported yet</p>
                  <button mat-raised-button color="primary" (click)="goToImport()" class="import-button">
                    <mat-icon>upload</mat-icon>
                    <span>Import Calendars</span>
                  </button>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Stats Card -->
          <mat-card class="stats-card">
            <mat-card-content>
              <div class="stat-item">
                <mat-icon>event</mat-icon>
                <div class="stat-details">
                  <span class="stat-value">{{ totalEvents() }}</span>
                  <span class="stat-label">Total Events</span>
                </div>
              </div>
              <div class="stat-item">
                <mat-icon color="warn">warning</mat-icon>
                <div class="stat-details">
                  <span class="stat-value">{{ overdueCount() }}</span>
                  <span class="stat-label">Overdue</span>
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Calendar View -->
        <div class="calendar-main">
          <mat-card>
            <mat-card-content>
              <!-- View Toggle -->
              <div class="calendar-controls">
                <mat-button-toggle-group [(value)]="currentView" (change)="changeView($event.value)">
                  <mat-button-toggle value="dayGridMonth">
                    <mat-icon>view_module</mat-icon>
                    <span>Month</span>
                  </mat-button-toggle>
                  <mat-button-toggle value="timeGridWeek">
                    <mat-icon>view_week</mat-icon>
                    <span>Week</span>
                  </mat-button-toggle>
                  <mat-button-toggle value="timeGridDay">
                    <mat-icon>view_day</mat-icon>
                    <span>Day</span>
                  </mat-button-toggle>
                </mat-button-toggle-group>
              </div>

              <!-- FullCalendar -->
              <div class="calendar-wrapper">
                <full-calendar [options]="calendarOptions"></full-calendar>
              </div>

              <div *ngIf="(filteredEvents$ | async)?.length === 0" class="empty-calendar">
                <mat-icon>event_busy</mat-icon>
                <p>No events to display</p>
                <p class="hint">Import ICS files or adjust course filters</p>
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .calendar-container {
      height: 100vh;
      display: flex;
      flex-direction: column;
      background-color: #f5f5f5;
    }

    .calendar-toolbar {
      h1 {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 0;
        font-size: 20px;
        font-weight: 500;
      }

      .spacer {
        flex: 1;
      }
    }

    .content {
      flex: 1;
      display: flex;
      gap: 20px;
      padding: 20px;
      overflow: hidden;
    }

    .sidebar {
      width: 300px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;

      mat-card {
        mat-card-header {
          margin-bottom: 16px;
        }
      }
    }

    .course-filters {
      .filter-actions {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e0e0e0;

        .filter-button {
          flex: 1;
          font-size: 13px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 12px;
          white-space: nowrap;

          mat-icon {
            margin: 0;
            font-size: 18px;
            width: 18px;
            height: 18px;
          }

          span {
            line-height: 1.5;
          }
        }
      }

      .course-chips {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .course-chip {
        justify-content: flex-start;

        .chip-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          margin-right: 8px;
        }
      }

      .empty-state {
        text-align: center;
        padding: 32px 16px;
        color: #999;

        mat-icon {
          font-size: 64px;
          width: 64px;
          height: 64px;
          margin-bottom: 16px;
        }

        p {
          margin: 8px 0;
        }

        .import-button {
          margin-top: 16px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;

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
    }

    .stats-card {
      mat-card-content {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 16px;
      }

      .stat-item {
        display: flex;
        align-items: center;
        gap: 16px;

        mat-icon {
          font-size: 32px;
          width: 32px;
          height: 32px;
          color: #3f51b5;
        }

        .stat-details {
          display: flex;
          flex-direction: column;

          .stat-value {
            font-size: 24px;
            font-weight: 600;
            color: #333;
          }

          .stat-label {
            font-size: 12px;
            color: #666;
          }
        }
      }
    }

    .calendar-main {
      flex: 1;
      overflow: hidden;

      mat-card {
        height: 100%;
        display: flex;
        flex-direction: column;

        mat-card-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
      }
    }

    .calendar-controls {
      display: flex;
      justify-content: center;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e0e0e0;

      mat-button-toggle {
        padding: 10px 20px;
        display: inline-flex;
        align-items: center;
        gap: 8px;

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

      mat-button-toggle-group {
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
    }

    .calendar-wrapper {
      flex: 1;
      overflow: auto;
    }

    .empty-calendar {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #999;

      mat-icon {
        font-size: 80px;
        width: 80px;
        height: 80px;
        margin-bottom: 16px;
      }

      p {
        margin: 4px 0;
        font-size: 16px;
      }

      .hint {
        font-size: 14px;
        color: #bbb;
      }
    }

    /* Responsive */
    @media (max-width: 768px) {
      .content {
        flex-direction: column;
      }

      .sidebar {
        width: 100%;
      }
    }
  `]
})
export class CalendarComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private eventManager = inject(EventManagerService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  courses$ = this.eventManager.courses$;
  filteredEvents$ = this.eventManager.filteredEvents$;
  activeCourseIds$ = this.eventManager.activeCourseIds$;

  totalEvents = signal(0);
  overdueCount = signal(0);
  currentView = 'dayGridMonth';
  activeCourseIds: string[] = [];

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: ''
    },
    weekends: true,
    editable: false,
    selectable: false,
    selectMirror: true,
    dayMaxEvents: true,
    events: [],
    eventClick: this.handleEventClick.bind(this),
    height: '100%',
    eventClassNames: (arg) => {
      const event = arg.event;
      return [`event-type-${event.extendedProps['eventType']}`];
    }
  };

  ngOnInit(): void {
    // Subscribe to filtered events and update calendar
    this.filteredEvents$.pipe(takeUntil(this.destroy$)).subscribe(events => {
      this.updateCalendarEvents(events);
      this.totalEvents.set(events.length);
      this.overdueCount.set(events.filter(e => e.status === 'overdue').length);
    });

    // Track active course IDs
    this.activeCourseIds$.pipe(takeUntil(this.destroy$)).subscribe(ids => {
      this.activeCourseIds = ids;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  updateCalendarEvents(events: CalendarEvent[]): void {
    this.calendarOptions.events = events.map(event => ({
      id: event.id,
      title: event.title,
      start: event.startDate,
      end: event.endDate,
      allDay: event.isAllDay,
      backgroundColor: event.courseColor,
      borderColor: event.courseColor,
      extendedProps: {
        description: event.description,
        courseId: event.courseId,
        courseName: event.courseName,
        eventType: event.eventType,
        status: event.status,
        location: event.location
      }
    }));
  }

  handleEventClick(clickInfo: EventClickArg): void {
    const event = clickInfo.event;
    const props = event.extendedProps;

    alert(`
      ${event.title}

      Course: ${props['courseName']}
      Type: ${props['eventType']}
      Date: ${event.start?.toLocaleDateString()}
      ${props['description'] ? '\n' + props['description'] : ''}
    `);
  }

  changeView(view: string): void {
    this.calendarOptions.initialView = view;
  }

  isActiveCourse(courseId: string): boolean {
    return this.activeCourseIds.includes(courseId);
  }

  toggleCourse(courseId: string): void {
    this.eventManager.toggleCourseFilter(courseId);
  }

  showAllCourses(): void {
    this.eventManager.showAllCourses();
  }

  hideAllCourses(): void {
    this.eventManager.hideAllCourses();
  }

  goToImport(): void {
    this.router.navigate(['/import']);
  }
}
