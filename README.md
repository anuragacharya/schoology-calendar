# Schoology Calendar Web App

A modern web application to view and manage your Schoology calendar events and assignments. Import your Schoology calendar .ics file and view all your events in a beautiful calendar interface.

## Features

- 📅 Beautiful calendar view with day, week, and month views
- 📥 Import Schoology calendar via .ics file
- 📊 View all assignments and exams in one place
- 💾 Local storage - your data stays on your device
- 🎨 Material Design UI with Angular Material

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm (v11 or higher)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/anuragacharya/schoology-calendar.git
cd schoology-calendar
```

2. Install dependencies:
```bash
npm install
```

### Development Server

To start a local development server, run:

```bash
npm start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## How to Use

1. **Login**: Enter your Schoology email and password (stored locally in your browser)
2. **Import Calendar**:
   - Go to your Schoology calendar
   - Export your calendar as an .ics file
   - Import the file into the app
3. **View Events**: Browse your assignments and exams in the calendar view
4. **Update**: Re-import your calendar file to sync new events

## Building for Production

To build the project for production:

```bash
npm run build
```

This will compile your project and store the build artifacts in the `dist/` directory, optimized for performance and speed.

## Technology Stack

- **Frontend Framework**: Angular 21
- **UI Components**: Angular Material
- **Calendar**: FullCalendar
- **Local Database**: Dexie (IndexedDB wrapper)
- **ICS Parsing**: ical.js

## Running Tests

To execute unit tests with [Vitest](https://vitest.dev/):

```bash
npm test
```

## Project Structure

```
src/
├── app/
│   ├── core/
│   │   ├── models/          # Data models
│   │   └── services/        # Business logic services
│   ├── features/
│   │   ├── login/           # Login component
│   │   ├── calendar/        # Calendar view
│   │   └── import/          # ICS import component
│   └── app.ts               # Root component
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.
