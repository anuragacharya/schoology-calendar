const SchoologyScraper = require('./schoology-scraper');
const { db } = require('../../src/app/core/services/storage.service');

class SyncService {
  constructor(store, mainWindow) {
    this.store = store;
    this.mainWindow = mainWindow;
    this.syncInterval = null;
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.syncIntervalMinutes = store.get('syncInterval', 30); // Default 30 minutes
  }

  /**
   * Start automatic syncing
   */
  startAutoSync() {
    if (this.syncInterval) {
      this.stopAutoSync();
    }

    console.log(`Starting auto-sync (every ${this.syncIntervalMinutes} minutes)`);

    // Sync immediately on start
    this.syncNow();

    // Set up recurring sync
    this.syncInterval = setInterval(() => {
      this.syncNow();
    }, this.syncIntervalMinutes * 60 * 1000);
  }

  /**
   * Stop automatic syncing
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Auto-sync stopped');
    }
  }

  /**
   * Set sync interval in minutes
   */
  setSyncInterval(minutes) {
    this.syncIntervalMinutes = minutes;
    this.store.set('syncInterval', minutes);

    // Restart sync with new interval
    if (this.syncInterval) {
      this.startAutoSync();
    }
  }

  /**
   * Perform sync now
   */
  async syncNow() {
    if (this.isSyncing) {
      console.log('Sync already in progress, skipping...');
      return { success: false, message: 'Sync already in progress' };
    }

    this.isSyncing = true;
    this.notifyRenderer('sync-start');

    try {
      console.log('Starting sync...');

      // Get stored credentials
      const credentials = this.store.get('credentials');
      if (!credentials || !credentials.email || !credentials.password) {
        throw new Error('No credentials found. Please log in first.');
      }

      // Create scraper instance
      const scraper = new SchoologyScraper();

      // Scrape data from Schoology
      const result = await scraper.scrapeAllData(credentials.email, credentials.password);

      if (!result.success) {
        throw new Error(result.error || 'Failed to scrape Schoology');
      }

      // Process and store the data
      await this.processScrapedData(result.courses, result.events);

      this.lastSyncTime = new Date();
      this.store.set('lastSyncTime', this.lastSyncTime.toISOString());

      console.log(`Sync completed successfully. Courses: ${result.courses.length}, Events: ${result.events.length}`);

      this.notifyRenderer('sync-complete', {
        coursesCount: result.courses.length,
        eventsCount: result.events.length,
        timestamp: this.lastSyncTime
      });

      return {
        success: true,
        coursesCount: result.courses.length,
        eventsCount: result.events.length
      };

    } catch (error) {
      console.error('Sync error:', error);
      this.notifyRenderer('sync-error', error.message);

      return {
        success: false,
        error: error.message
      };

    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Process scraped data and store in database
   */
  async processScrapedData(courses, events) {
    try {
      // Import Dexie database
      const Dexie = require('dexie');

      // Create or connect to database
      class AppDatabase extends Dexie {
        constructor() {
          super('SchoologyCalendarDB');
          this.version(1).stores({
            events: 'id, courseId, startDate, eventType, status',
            courses: 'id, name, isActive'
          });
        }
      }

      const database = new AppDatabase();

      // Generate colors for new courses
      const colorPalette = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
        '#6C5CE7', '#A29BFE', '#FD79A8', '#FDCB6E', '#E17055',
        '#74B9FF', '#A29BFE', '#00B894', '#00CEC9', '#FF7675'
      ];

      // Process courses
      const existingCourses = await database.courses.toArray();
      const existingCourseIds = existingCourses.map(c => c.id);

      for (let i = 0; i < courses.length; i++) {
        const course = courses[i];

        if (!existingCourseIds.includes(course.id)) {
          // New course - add it
          await database.courses.add({
            id: course.id,
            name: course.name,
            color: colorPalette[i % colorPalette.length],
            isActive: true,
            importedDate: new Date(),
            eventCount: course.eventCount,
            icsFileName: 'auto-sync'
          });
        } else {
          // Update existing course
          await database.courses.update(course.id, {
            eventCount: course.eventCount
          });
        }
      }

      // Process events - clear old events and add new ones
      // First, get existing event IDs to detect changes
      const existingEvents = await database.events.toArray();
      const existingEventMap = new Map(existingEvents.map(e => [this.generateEventKey(e), e.id]));

      // Track which existing events we've seen
      const seenEventIds = new Set();

      for (const event of events) {
        const eventKey = this.generateEventKey(event);
        const existingEventId = existingEventMap.get(eventKey);

        const calendarEvent = {
          id: existingEventId || this.generateUniqueId(),
          title: event.title,
          description: event.description || '',
          startDate: new Date(event.dueDate),
          endDate: new Date(event.dueDate),
          eventType: event.type,
          courseId: event.courseId,
          courseName: event.courseName,
          courseColor: colorPalette[Math.floor(Math.random() * colorPalette.length)],
          status: new Date(event.dueDate) < new Date() ? 'overdue' : 'upcoming',
          isAllDay: true,
          location: '',
          recurrence: undefined,
          rawIcsData: JSON.stringify(event)
        };

        if (existingEventId) {
          // Update existing event
          await database.events.update(existingEventId, calendarEvent);
          seenEventIds.add(existingEventId);
        } else {
          // Add new event
          const newId = await database.events.add(calendarEvent);
          seenEventIds.add(newId);
        }
      }

      // Delete events that no longer exist in Schoology
      const eventIdsToDelete = Array.from(existingEventMap.values()).filter(id => !seenEventIds.has(id));
      if (eventIdsToDelete.length > 0) {
        await database.events.bulkDelete(eventIdsToDelete);
        console.log(`Deleted ${eventIdsToDelete.length} old events`);
      }

      // Notify renderer that data has been updated
      this.notifyRenderer('data-updated', {
        coursesCount: courses.length,
        eventsCount: events.length
      });

      console.log('Data processing completed');

    } catch (error) {
      console.error('Error processing scraped data:', error);
      throw error;
    }
  }

  /**
   * Generate a unique key for an event (for detecting duplicates)
   */
  generateEventKey(event) {
    return `${event.courseId}-${event.title}-${event.dueDate}`;
  }

  /**
   * Generate a unique ID
   */
  generateUniqueId() {
    return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send notification to renderer process
   */
  notifyRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  /**
   * Get current sync status
   */
  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      syncIntervalMinutes: this.syncIntervalMinutes,
      autoSyncEnabled: this.syncInterval !== null
    };
  }
}

module.exports = SyncService;
