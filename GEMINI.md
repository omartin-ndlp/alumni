# Gemini Agent Instructions

This file contains instructions for the Gemini AI agent working in this repository.

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

## CI/CD (GitLab)
- `.gitlab-ci.yml` - Pipeline configuration
- Automated testing on all branches and MRs
- Code quality checks with ESLint
- Security audits with npm audit
- Automated deployments to staging/production
- Database migrations and backups
- Multi-stage builds (test, build, deploy)

## Deployment
- `npm run deploy:staging` - Deploy to staging
- `npm run deploy:production` - Deploy to production
- `npm run db:backup` - Create database backup
- Docker support with docker-compose.yml
- PM2 configuration in ecosystem.config.js

## Test Suites
Here's a list of test suites that could be added to this project to ensure non-regression:

1.  **Unit Tests:**
    *   `src/models/User.js`: Test user creation, password hashing, finding users, and other model-specific methods.
    *   `src/models/Employer.js`: Test employer creation and retrieval.
    *   `src/middleware/auth.js`: Test authentication and authorization middleware logic.
    *   Individual route handler functions (e.g., in `src/routes/auth.js`, `src/routes/profile.js`) to verify their internal logic.

2.  **Integration Tests:**
    *   **Authentication Flow:** Test user registration, login, and logout processes end-to-end, including session management.
    *   **User Profile Management:** Test updating user profiles and employment details.
    *   **Admin Functionality:** Test user approval requests, user listing, and other admin-specific actions.
    *   **Database Interactions:** Verify that data is correctly persisted and retrieved across different parts of the application.

3.  **API/Route Tests:**
    *   Test all defined API endpoints (`src/routes/*.js`) to ensure they return the correct HTTP status codes and data for various scenarios (e.g., valid/invalid input, authenticated/unauthenticated access, edge cases).

4.  **Security Tests:**
    *   **Input Validation:** Verify that `express-validator` correctly handles invalid inputs and prevents common vulnerabilities.
    *   **Access Control:** Ensure that unauthorized users cannot access protected routes or perform actions they shouldn't.
    *   **Rate Limiting:** Test the effectiveness of rate limiting on relevant endpoints.

5.  **Database Migration & Seeding Tests:**
    *   Verify that `scripts/migrate.js` and `scripts/seed.js` execute successfully and result in the expected database schema and initial data.

## Jest Best Practices
To avoid Jest tests hanging or running indefinitely, ensure the following:

-   **Close Open Handles:** Always explicitly close any open resources (e.g., database connections, server instances, timers like `setInterval`) in `afterAll` or `afterEach` hooks.
-   **Handle Asynchronous Operations:**
    -   When using `async/await`, ensure all promises are `await`ed within your `async` test functions.
    -   If not using `async/await`, `return` promises from your tests or use the `done()` callback for older asynchronous patterns.
-   **Debugging:** Use the `--detectOpenHandles` flag (e.g., `npm test -- --detectOpenHandles`) to identify resources preventing Jest from exiting.
## Important Instructions
-   **Do not commit or delete commits without explicit approval.**
