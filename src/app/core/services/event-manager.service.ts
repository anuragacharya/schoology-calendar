import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { CalendarEvent, EventType, EventStatus } from '../models/calendar-event.model';
import { Course } from '../models/course.model';
import { StorageService } from './storage.service';

/**
 * Event Manager Service
 * Central state management for calendar events and courses
 * Uses RxJS BehaviorSubjects for reactive data flow
 */
@Injectable({
  providedIn: 'root'
})
export class EventManagerService {

  // State subjects
  private eventsSubject = new BehaviorSubject<CalendarEvent[]>([]);
  private coursesSubject = new BehaviorSubject<Course[]>([]);
  private activeCourseIdsSubject = new BehaviorSubject<string[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  // Public observables
  public events$ = this.eventsSubject.asObservable();
  public courses$ = this.coursesSubject.asObservable();
  public activeCourseIds$ = this.activeCourseIdsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  // Filtered events based on active courses
  public filteredEvents$: Observable<CalendarEvent[]> = combineLatest([
    this.events$,
    this.activeCourseIds$
  ]).pipe(
    map(([events, activeCourseIds]) => {
      if (activeCourseIds.length === 0) {
        return events; // Show all events if no filter is active
      }
      return events.filter(event => activeCourseIds.includes(event.courseId));
    })
  );

  // Active courses only
  public activeCourses$: Observable<Course[]> = this.courses$.pipe(
    map(courses => courses.filter(course => course.isActive))
  );

  constructor(private storageService: StorageService) {
    this.loadData();
  }

  /**
   * Load all data from storage on initialization
   */
  private async loadData(): Promise<void> {
    this.loadingSubject.next(true);
    try {
      const [events, courses] = await Promise.all([
        this.storageService.getAllEvents(),
        this.storageService.getAllCourses()
      ]);

      this.eventsSubject.next(events);
      this.coursesSubject.next(courses);

      // Set all courses as active by default
      const allCourseIds = courses.map(c => c.id);
      this.activeCourseIdsSubject.next(allCourseIds);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Reload all data from storage
   */
  async reloadData(): Promise<void> {
    await this.loadData();
  }

  // ==================== EVENT OPERATIONS ====================

  /**
   * Add a single event
   */
  async addEvent(event: CalendarEvent): Promise<void> {
    await this.storageService.addEvent(event);
    await this.reloadEvents();
  }

  /**
   * Add multiple events (bulk import)
   */
  async addEvents(events: CalendarEvent[]): Promise<void> {
    await this.storageService.addEvents(events);
    await this.reloadEvents();
  }

  /**
   * Update an event
   */
  async updateEvent(id: string, changes: Partial<CalendarEvent>): Promise<void> {
    await this.storageService.updateEvent(id, changes);
    await this.reloadEvents();
  }

  /**
   * Delete an event
   */
  async deleteEvent(id: string): Promise<void> {
    await this.storageService.deleteEvent(id);
    await this.reloadEvents();
  }

  /**
   * Mark event as completed
   */
  async markEventCompleted(id: string): Promise<void> {
    await this.updateEvent(id, { status: EventStatus.COMPLETED });
  }

  /**
   * Reload events from storage
   */
  private async reloadEvents(): Promise<void> {
    const events = await this.storageService.getAllEvents();
    this.eventsSubject.next(events);
  }

  // ==================== COURSE OPERATIONS ====================

  /**
   * Add a new course
   */
  async addCourse(course: Course): Promise<void> {
    await this.storageService.addCourse(course);
    await this.reloadCourses();

    // Add to active courses
    const currentActive = this.activeCourseIdsSubject.value;
    this.activeCourseIdsSubject.next([...currentActive, course.id]);
  }

  /**
   * Update a course
   */
  async updateCourse(id: string, changes: Partial<Course>): Promise<void> {
    await this.storageService.updateCourse(id, changes);
    await this.reloadCourses();
  }

  /**
   * Delete a course and its events
   */
  async deleteCourse(id: string): Promise<void> {
    await this.storageService.deleteCourse(id, true);
    await Promise.all([this.reloadCourses(), this.reloadEvents()]);

    // Remove from active courses
    const currentActive = this.activeCourseIdsSubject.value;
    this.activeCourseIdsSubject.next(currentActive.filter(cid => cid !== id));
  }

  /**
   * Reload courses from storage
   */
  private async reloadCourses(): Promise<void> {
    const courses = await this.storageService.getAllCourses();
    this.coursesSubject.next(courses);
  }

  // ==================== FILTER OPERATIONS ====================

  /**
   * Set active course IDs (for filtering)
   */
  setActiveCourseIds(courseIds: string[]): void {
    this.activeCourseIdsSubject.next(courseIds);
  }

  /**
   * Toggle a course's visibility in the filter
   */
  toggleCourseFilter(courseId: string): void {
    const currentActive = this.activeCourseIdsSubject.value;
    if (currentActive.includes(courseId)) {
      this.activeCourseIdsSubject.next(currentActive.filter(id => id !== courseId));
    } else {
      this.activeCourseIdsSubject.next([...currentActive, courseId]);
    }
  }

  /**
   * Show all courses
   */
  showAllCourses(): void {
    const allCourseIds = this.coursesSubject.value.map(c => c.id);
    this.activeCourseIdsSubject.next(allCourseIds);
  }

  /**
   * Hide all courses
   */
  hideAllCourses(): void {
    this.activeCourseIdsSubject.next([]);
  }

  // ==================== SEARCH & FILTER ====================

  /**
   * Search events by keyword (title or description)
   */
  searchEvents(keyword: string): Observable<CalendarEvent[]> {
    return this.filteredEvents$.pipe(
      map(events => {
        if (!keyword || keyword.trim() === '') {
          return events;
        }
        const lowerKeyword = keyword.toLowerCase();
        return events.filter(event =>
          event.title.toLowerCase().includes(lowerKeyword) ||
          event.description.toLowerCase().includes(lowerKeyword) ||
          event.courseName.toLowerCase().includes(lowerKeyword)
        );
      })
    );
  }

  /**
   * Get events by date range
   */
  getEventsByDateRange(startDate: Date, endDate: Date): Observable<CalendarEvent[]> {
    return this.filteredEvents$.pipe(
      map(events => events.filter(event =>
        event.startDate >= startDate && event.startDate <= endDate
      ))
    );
  }

  /**
   * Get events by type
   */
  getEventsByType(type: EventType): Observable<CalendarEvent[]> {
    return this.filteredEvents$.pipe(
      map(events => events.filter(event => event.eventType === type))
    );
  }

  /**
   * Get events by status
   */
  getEventsByStatus(status: EventStatus): Observable<CalendarEvent[]> {
    return this.filteredEvents$.pipe(
      map(events => events.filter(event => event.status === status))
    );
  }

  /**
   * Get upcoming events (sorted by start date)
   */
  getUpcomingEvents(limit?: number): Observable<CalendarEvent[]> {
    return this.filteredEvents$.pipe(
      map(events => {
        const upcoming = events
          .filter(event => event.status === EventStatus.UPCOMING)
          .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
        return limit ? upcoming.slice(0, limit) : upcoming;
      })
    );
  }

  /**
   * Get overdue events
   */
  getOverdueEvents(): Observable<CalendarEvent[]> {
    return this.filteredEvents$.pipe(
      map(events =>
        events
          .filter(event => event.status === EventStatus.OVERDUE)
          .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
      )
    );
  }

  // ==================== STATISTICS ====================

  /**
   * Get total event count
   */
  getTotalEventCount(): Observable<number> {
    return this.events$.pipe(map(events => events.length));
  }

  /**
   * Get total course count
   */
  getTotalCourseCount(): Observable<number> {
    return this.courses$.pipe(map(courses => courses.length));
  }

  /**
   * Get events count by course
   */
  getEventCountByCourse(courseId: string): Observable<number> {
    return this.events$.pipe(
      map(events => events.filter(e => e.courseId === courseId).length)
    );
  }

  // ==================== UTILITY ====================

  /**
   * Generate a unique ID
   */
  generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a random color for courses
   */
  generateRandomColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#6C5CE7', '#A29BFE', '#FD79A8', '#FDCB6E', '#E17055',
      '#74B9FF', '#A29BFE', '#00B894', '#00CEC9', '#FF7675'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Clear all data
   */
  async clearAllData(): Promise<void> {
    await this.storageService.clearAllData();
    this.eventsSubject.next([]);
    this.coursesSubject.next([]);
    this.activeCourseIdsSubject.next([]);
  }

  /**
   * Export all data
   */
  async exportData(): Promise<{ events: CalendarEvent[], courses: Course[] }> {
    return await this.storageService.exportData();
  }

  /**
   * Import data
   */
  async importData(data: { events: CalendarEvent[], courses: Course[] }): Promise<void> {
    await this.storageService.importData(data);
    await this.reloadData();
  }
}
