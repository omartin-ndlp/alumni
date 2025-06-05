# Agent Instructions

This file contains instructions for AI coding agents working in this repository.

## Commands
- Dev server: `npm run dev` (starts with nodemon)
- Production: `npm start` 
- Test: `npm test`
- Single test: `npm test -- tests/unit/User.test.js`
- Test coverage: `npm run test:coverage`
- Lint: `npm run lint`
- Lint fix: `npm run lint:fix`
- Database migrate: `npm run db:migrate`
- Database seed: `npm run db:seed`

## Code Style
- Use JavaScript (Node.js) with Express.js
- Import order: external libraries first, then internal modules
- Use named exports over default exports
- camelCase for functions/variables, PascalCase for classes
- Use const/let appropriately, avoid var
- Handle errors explicitly with try/catch blocks
- Follow existing patterns in the codebase
- French language for user-facing text
- Use EJS templates for views

## Project Structure
- `src/` - Main application code
  - `config/` - Database and app configuration
  - `middleware/` - Express middleware
  - `models/` - Data models (User, Employer)
  - `routes/` - Express routes (auth, profile, users, admin)
  - `views/` - EJS templates
- `public/` - Static files (CSS, JS, images, uploads)
- `scripts/` - Database migration and seeding scripts
- `tests/` - Unit and integration tests
- `.env` - Environment configuration (not in git)

## Database
- MySQL with mysql2 driver
- Tables: users, sections, employers, user_employment, registration_requests
- All queries use parameterized statements for security
- Migrations in `scripts/migrate.js`

## Security
- bcryptjs for password hashing
- helmet for security headers
- express-session for session management
- express-validator for input validation
- Rate limiting with express-rate-limit
