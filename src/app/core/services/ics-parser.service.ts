import { Injectable } from '@angular/core';
import ICAL from 'ical.js';
import { CalendarEvent, EventType, EventStatus } from '../models/calendar-event.model';
import { IcsImportResult, ImportError } from '../models/ics-import-result.model';

/**
 * ICS Parser Service
 * Parses iCalendar (.ics) files using ical.js library
 * Extracts events and transforms them to CalendarEvent model
 */
@Injectable({
  providedIn: 'root'
})
export class IcsParserService {

  constructor() {}

  /**
   * Parse ICS file content and extract events
   * @param fileContent Raw ICS file content as string
   * @param courseId Course ID to associate with events
   * @param courseName Course name for display
   * @param courseColor Color for visual distinction
   * @param fileName Original file name
   * @returns IcsImportResult with parsed events or errors
   */
  parseIcsFile(
    fileContent: string,
    courseId: string,
    courseName: string,
    courseColor: string,
    fileName: string
  ): IcsImportResult {
    const result: IcsImportResult = {
      success: false,
      fileName,
      courseId,
      courseName,
      eventsImported: 0,
      errors: [],
      warnings: []
    };

    try {
      // Parse ICS content using ical.js
      const jcalData = ICAL.parse(fileContent);
      const comp = new ICAL.Component(jcalData);

      // Get all VEVENT components
      const vevents = comp.getAllSubcomponents('vevent');

      if (vevents.length === 0) {
        result.warnings.push('No events found in ICS file');
      }

      // Parse each event
      const events: CalendarEvent[] = [];
      vevents.forEach((vevent: any, index: number) => {
        try {
          const event = new ICAL.Event(vevent);
          const calendarEvent = this.transformToCalendarEvent(
            event,
            courseId,
            courseName,
            courseColor
          );
          events.push(calendarEvent);
        } catch (error) {
          result.errors.push({
            line: index + 1,
            message: `Failed to parse event: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'error'
          });
        }
      });

      result.eventsImported = events.length;
      result.success = events.length > 0;

      // Store events in result (will be saved by calling service)
      (result as any).events = events;

      return result;

    } catch (error) {
      result.success = false;
      result.errors.push({
        message: `Failed to parse ICS file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
      return result;
    }
  }

  /**
   * Transform ICAL.Event to CalendarEvent model
   */
  private transformToCalendarEvent(
    icalEvent: any,
    courseId: string,
    courseName: string,
    courseColor: string
  ): CalendarEvent {
    const startDate = icalEvent.startDate.toJSDate();
    const endDate = icalEvent.endDate.toJSDate();
    const now = new Date();

    return {
      id: icalEvent.uid || this.generateUniqueId(),
      title: icalEvent.summary || 'Untitled Event',
      description: icalEvent.description || '',
      startDate,
      endDate,
      eventType: this.detectEventType(icalEvent.summary || '', icalEvent.description || ''),
      courseId,
      courseName,
      courseColor,
      location: icalEvent.location || undefined,
      status: this.determineEventStatus(endDate, now),
      isAllDay: icalEvent.startDate.isDate,
      recurrence: this.extractRecurrence(icalEvent),
      rawIcsData: icalEvent.toString()
    };
  }

  /**
   * Detect event type from title and description
   * Looks for keywords like "exam", "quiz", "assignment", "project"
   */
  private detectEventType(summary: string, description: string): EventType {
    const text = (summary + ' ' + description).toLowerCase();

    if (text.includes('exam') || text.includes('test') || text.includes('midterm') || text.includes('final')) {
      return EventType.EXAM;
    }
    if (text.includes('quiz')) {
      return EventType.QUIZ;
    }
    if (text.includes('project')) {
      return EventType.PROJECT;
    }
    if (text.includes('assignment') || text.includes('homework') || text.includes('hw')) {
      return EventType.ASSIGNMENT;
    }

    return EventType.OTHER;
  }

  /**
   * Determine event status based on end date
   */
  private determineEventStatus(endDate: Date, now: Date): EventStatus {
    if (endDate < now) {
      return EventStatus.OVERDUE;
    }
    return EventStatus.UPCOMING;
  }

  /**
   * Extract recurrence rule from ICAL event
   */
  private extractRecurrence(icalEvent: any): any {
    try {
      const rrule = icalEvent.component.getFirstProperty('rrule');
      if (!rrule) return undefined;

      const rruleValue = rrule.getFirstValue();
      if (!rruleValue) return undefined;

      const freq = rruleValue.freq;
      const interval = rruleValue.interval || 1;
      const until = rruleValue.until ? rruleValue.until.toJSDate() : undefined;

      return {
        frequency: freq.toLowerCase() as 'daily' | 'weekly' | 'monthly',
        interval,
        until
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Extract course name from ICS file metadata
   * Fallback strategies:
   * 1. Check X-WR-CALNAME property
   * 2. Parse from filename
   * 3. Return 'Unnamed Course'
   */
  extractCourseName(icsContent: string, fileName: string): string {
    try {
      const jcalData = ICAL.parse(icsContent);
      const comp = new ICAL.Component(jcalData);

      // Strategy 1: Check X-WR-CALNAME property
      const calName = comp.getFirstPropertyValue('x-wr-calname');
      if (calName) {
        return calName.toString();
      }

      // Strategy 2: Parse from filename
      // Example: "Math-101-Calendar.ics" → "Math 101"
      const nameMatch = fileName.match(/^(.+?)(?:-calendar)?\.ics$/i);
      if (nameMatch) {
        return nameMatch[1]
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
      }

      return 'Unnamed Course';
    } catch {
      return 'Unnamed Course';
    }
  }

  /**
   * Generate a unique ID for events without UIDs
   */
  private generateUniqueId(): string {
    return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate ICS file content
   */
  validateIcsContent(content: string): { valid: boolean; error?: string } {
    try {
      ICAL.parse(content);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Invalid ICS file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get event count from ICS content without full parsing
   */
  getEventCount(icsContent: string): number {
    try {
      const jcalData = ICAL.parse(icsContent);
      const comp = new ICAL.Component(jcalData);
      const vevents = comp.getAllSubcomponents('vevent');
      return vevents.length;
    } catch {
      return 0;
    }
  }
}
