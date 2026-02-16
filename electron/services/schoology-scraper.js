const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

class SchoologyScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  /**
   * Initialize browser
   */
  async initialize() {
    if (this.browser) {
      return;
    }

    this.browser = await puppeteer.launch({
      headless: true, // Set to false for debugging
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
  }

  /**
   * Login to Schoology using Microsoft OAuth
   */
  async login(email, password) {
    try {
      await this.initialize();

      this.page = await this.browser.newPage();
      await this.page.setViewport({ width: 1280, height: 800 });

      // Go to Schoology login page
      console.log('Navigating to Schoology...');
      await this.page.goto('https://learn.lcps.org/login', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      // Click "Sign in with Microsoft" button
      console.log('Looking for Microsoft login button...');
      await this.page.waitForSelector('a[href*="microsoft"]', { timeout: 10000 });
      await this.page.click('a[href*="microsoft"]');

      // Wait for Microsoft login page
      console.log('Waiting for Microsoft login page...');
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });

      // Enter email
      console.log('Entering email...');
      await this.page.waitForSelector('input[type="email"]', { timeout: 10000 });
      await this.page.type('input[type="email"]', email, { delay: 100 });
      await this.page.click('input[type="submit"]');

      // Wait for password page
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });

      // Enter password
      console.log('Entering password...');
      await this.page.waitForSelector('input[type="password"]', { timeout: 10000 });
      await this.page.type('input[type="password"]', password, { delay: 100 });
      await this.page.click('input[type="submit"]');

      // Wait for "Stay signed in?" prompt
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });

      // Click "Yes" to stay signed in
      try {
        await this.page.waitForSelector('input[type="submit"]', { timeout: 5000 });
        await this.page.click('input[type="submit"]');
        await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
      } catch (e) {
        // "Stay signed in" prompt might not appear
        console.log('No "stay signed in" prompt');
      }

      // Wait for Schoology to load
      console.log('Waiting for Schoology to load...');
      await this.page.waitForSelector('.sHomeButton, .s-calendar-wrapper, #header', { timeout: 30000 });

      console.log('Login successful!');
      return { success: true };

    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get list of enrolled courses
   */
  async getCourses() {
    try {
      if (!this.page) {
        throw new Error('Not logged in');
      }

      // Navigate to courses page
      console.log('Navigating to courses...');
      await this.page.goto('https://learn.lcps.org/courses', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      // Extract course information
      const courses = await this.page.evaluate(() => {
        const courseElements = document.querySelectorAll('.course-item, .s-course-item, [class*="course"]');
        const coursesData = [];

        courseElements.forEach((element) => {
          const titleElement = element.querySelector('.course-title, h3, h4, a');
          const linkElement = element.querySelector('a[href*="/course/"]');

          if (titleElement && linkElement) {
            const title = titleElement.textContent.trim();
            const href = linkElement.getAttribute('href');
            const courseId = href.match(/\/course\/(\d+)/)?.[1];

            if (courseId) {
              coursesData.push({
                id: courseId,
                name: title,
                url: `https://learn.lcps.org/course/${courseId}/materials`
              });
            }
          }
        });

        return coursesData;
      });

      console.log(`Found ${courses.length} courses`);
      return courses;

    } catch (error) {
      console.error('Error getting courses:', error);
      throw error;
    }
  }

  /**
   * Scrape calendar events from a specific course
   */
  async getCourseCalendar(courseId, courseName) {
    try {
      if (!this.page) {
        throw new Error('Not logged in');
      }

      console.log(`Scraping calendar for: ${courseName}`);

      // Navigate to course materials/calendar page
      await this.page.goto(`https://learn.lcps.org/course/${courseId}/materials`, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      // Try to find and click on calendar/upcoming events
      // Schoology structure varies, try multiple selectors
      try {
        await this.page.waitForSelector('.upcoming-events, .s-calendar, [class*="calendar"]', { timeout: 5000 });
      } catch (e) {
        console.log('No calendar widget found, trying alternative...');
      }

      // Extract events from the page
      const events = await this.page.evaluate((cId, cName) => {
        const eventsData = [];

        // Look for event items (assignments, tests, etc.)
        const eventElements = document.querySelectorAll(
          '.upcoming-event, .s-event-title, [class*="assignment"], [class*="event"]'
        );

        eventElements.forEach((element) => {
          try {
            const titleElement = element.querySelector('.event-title, .title, h3, h4, a');
            const dateElement = element.querySelector('.date, .due-date, time, [class*="date"]');
            const descElement = element.querySelector('.description, .details');

            if (titleElement) {
              const title = titleElement.textContent.trim();
              const dateText = dateElement ? dateElement.textContent.trim() : '';
              const description = descElement ? descElement.textContent.trim() : '';

              // Try to parse date
              let dueDate = new Date();
              if (dateElement && dateElement.getAttribute('datetime')) {
                dueDate = new Date(dateElement.getAttribute('datetime'));
              } else if (dateText) {
                dueDate = new Date(dateText);
              }

              eventsData.push({
                title,
                description,
                dueDate: dueDate.toISOString(),
                courseId: cId,
                courseName: cName,
                type: title.toLowerCase().includes('exam') || title.toLowerCase().includes('test') ? 'exam' :
                      title.toLowerCase().includes('quiz') ? 'quiz' :
                      title.toLowerCase().includes('project') ? 'project' : 'assignment'
              });
            }
          } catch (err) {
            console.error('Error parsing event:', err);
          }
        });

        return eventsData;
      }, courseId, courseName);

      console.log(`Found ${events.length} events in ${courseName}`);
      return events;

    } catch (error) {
      console.error(`Error getting calendar for ${courseName}:`, error);
      return [];
    }
  }

  /**
   * Scrape all courses and their calendars
   */
  async scrapeAllData(email, password) {
    try {
      // Login
      const loginResult = await this.login(email, password);
      if (!loginResult.success) {
        throw new Error(loginResult.error);
      }

      // Get courses
      const courses = await this.getCourses();

      // Get calendar for each course
      const allEvents = [];
      const courseData = [];

      for (const course of courses) {
        const events = await this.getCourseCalendar(course.id, course.name);
        allEvents.push(...events);

        courseData.push({
          id: course.id,
          name: course.name,
          eventCount: events.length
        });

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      return {
        success: true,
        courses: courseData,
        events: allEvents
      };

    } catch (error) {
      console.error('Scraping error:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      await this.close();
    }
  }

  /**
   * Close browser
   */
  async close() {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = SchoologyScraper;
