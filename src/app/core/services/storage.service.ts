import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { CalendarEvent } from '../models/calendar-event.model';
import { Course } from '../models/course.model';

/**
 * IndexedDB database schema using Dexie.js
 * Provides persistent storage for calendar events and courses
 */
export class AppDatabase extends Dexie {
  events!: Table<CalendarEvent, string>;
  courses!: Table<Course, string>;

  constructor() {
    super('SchoologyCalendarDB');

    // Define database schema
    // Version 1: Initial schema
    this.version(1).stores({
      events: 'id, courseId, startDate, eventType, status',
      courses: 'id, name, isActive'
    });
  }
}

// Export singleton database instance
export const db = new AppDatabase();

/**
 * Storage Service
 * Provides CRUD operations for calendar events and courses using IndexedDB
 */
@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private db = db;

  constructor() {}

  // ==================== EVENT OPERATIONS ====================

  /**
   * Add a single event to the database
   */
  async addEvent(event: CalendarEvent): Promise<string> {
    return await this.db.events.add(event);
  }

  /**
   * Add multiple events in bulk (more efficient for ICS imports)
   * Uses bulkPut to update existing events instead of failing on duplicates
   */
  async addEvents(events: CalendarEvent[]): Promise<string[]> {
    return await this.db.events.bulkPut(events, { allKeys: true });
  }

  /**
   * Get a single event by ID
   */
  async getEvent(id: string): Promise<CalendarEvent | undefined> {
    return await this.db.events.get(id);
  }

  /**
   * Get all events
   */
  async getAllEvents(): Promise<CalendarEvent[]> {
    return await this.db.events.toArray();
  }

  /**
   * Get events by course ID
   */
  async getEventsByCourse(courseId: string): Promise<CalendarEvent[]> {
    return await this.db.events.where('courseId').equals(courseId).toArray();
  }

  /**
   * Get events by date range
   */
  async getEventsByDateRange(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    return await this.db.events
      .where('startDate')
      .between(startDate, endDate, true, true)
      .toArray();
  }

  /**
   * Get events by status (upcoming, overdue, completed)
   */
  async getEventsByStatus(status: string): Promise<CalendarEvent[]> {
    return await this.db.events.where('status').equals(status).toArray();
  }

  /**
   * Update an event
   */
  async updateEvent(id: string, changes: Partial<CalendarEvent>): Promise<number> {
    return await this.db.events.update(id, changes);
  }

  /**
   * Delete a single event
   */
  async deleteEvent(id: string): Promise<void> {
    await this.db.events.delete(id);
  }

  /**
   * Delete all events for a specific course
   */
  async deleteEventsByCourse(courseId: string): Promise<number> {
    return await this.db.events.where('courseId').equals(courseId).delete();
  }

  /**
   * Delete all events
   */
  async deleteAllEvents(): Promise<void> {
    await this.db.events.clear();
  }

  // ==================== COURSE OPERATIONS ====================

  /**
   * Add a new course
   */
  async addCourse(course: Course): Promise<string> {
    return await this.db.courses.add(course);
  }

  /**
   * Add multiple courses in bulk
   * Uses bulkPut to update existing courses instead of failing on duplicates
   */
  async addCourses(courses: Course[]): Promise<string[]> {
    return await this.db.courses.bulkPut(courses, { allKeys: true });
  }

  /**
   * Get a single course by ID
   */
  async getCourse(id: string): Promise<Course | undefined> {
    return await this.db.courses.get(id);
  }

  /**
   * Get all courses
   */
  async getAllCourses(): Promise<Course[]> {
    return await this.db.courses.toArray();
  }

  /**
   * Get active courses only
   */
  async getActiveCourses(): Promise<Course[]> {
    return await this.db.courses.filter(c => c.isActive === true).toArray();
  }

  /**
   * Update a course
   */
  async updateCourse(id: string, changes: Partial<Course>): Promise<number> {
    return await this.db.courses.update(id, changes);
  }

  /**
   * Toggle course active status
   */
  async toggleCourseActive(id: string): Promise<void> {
    const course = await this.getCourse(id);
    if (course) {
      await this.updateCourse(id, { isActive: !course.isActive });
    }
  }

  /**
   * Delete a course (and optionally its events)
   */
  async deleteCourse(id: string, deleteEvents: boolean = true): Promise<void> {
    if (deleteEvents) {
      await this.deleteEventsByCourse(id);
    }
    await this.db.courses.delete(id);
  }

  /**
   * Delete all courses
   */
  async deleteAllCourses(): Promise<void> {
    await this.db.courses.clear();
  }

  // ==================== UTILITY OPERATIONS ====================

  /**
   * Get total event count
   */
  async getEventCount(): Promise<number> {
    return await this.db.events.count();
  }

  /**
   * Get total course count
   */
  async getCourseCount(): Promise<number> {
    return await this.db.courses.count();
  }

  /**
   * Clear all data from the database
   */
  async clearAllData(): Promise<void> {
    await this.db.events.clear();
    await this.db.courses.clear();
  }

  /**
   * Check if database is empty
   */
  async isEmpty(): Promise<boolean> {
    const eventCount = await this.getEventCount();
    const courseCount = await this.getCourseCount();
    return eventCount === 0 && courseCount === 0;
  }

  /**
   * Export all data (for backup)
   */
  async exportData(): Promise<{ events: CalendarEvent[], courses: Course[] }> {
    const events = await this.getAllEvents();
    const courses = await this.getAllCourses();
    return { events, courses };
  }

  /**
   * Import data (for restore)
   */
  async importData(data: { events: CalendarEvent[], courses: Course[] }): Promise<void> {
    await this.db.transaction('rw', this.db.events, this.db.courses, async () => {
      // Clear existing data
      await this.db.events.clear();
      await this.db.courses.clear();

      // Import new data
      await this.db.events.bulkPut(data.events);
      await this.db.courses.bulkPut(data.courses);
    });
  }
}
