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
-   **Test Isolation (Integration Tests):** For integration tests involving the database, use a transaction-based approach. Start a transaction in `beforeEach` and roll it back in `afterEach` to ensure each test runs in an isolated, clean database state.

## Jest Test Execution Strategy (`--runInBand`)

This project mandates the use of the `--runInBand` flag for all Jest test commands (`npm test`, `npm run test:coverage`, `npm run test:unit`, `npm run test:integration`).

**Rationale:**

During development, an intermittent and alternating pass/fail pattern was observed when running integration tests in Jest's default multi-process worker environment. This issue was traced to the inconsistent propagation of global state, specifically the `global.__TEST_DB_POOL__` database connection pool, from the main Jest process (where `globalSetup` runs) to the individual test worker processes.

While `globalSetup` successfully initializes the database pool, Jest's worker processes do not reliably inherit this global state. This leads to tests failing when they attempt to acquire a database connection from an `undefined` or inaccessible pool. The "every other time" failure pattern was a strong indicator of a resource contention or state leakage issue related to the database connection pool's lifecycle across these separate processes.

By using `--runInBand`, all tests are forced to execute serially within a single Node.js process. This eliminates the multi-process communication overhead and ensures that the `global.__TEST_DB_POOL__` (initialized by `globalSetup`) is consistently available throughout the entire test run, thereby resolving the intermittent failures and providing reliable test results. While this sacrifices the performance benefits of parallel test execution, it prioritizes test stability and consistency, which is crucial for a robust CI/CD pipeline.
## Important Instructions
-   **Do not commit or delete commits without explicit approval.**

# Parameter Handling Strategy for `site-alumni` Project

This document outlines the **mandated** strategy for handling environment variables and sensitive parameters within this project. Adhering to these guidelines is crucial for consistent behavior, security, and maintainability across development, testing, and production environments.

## Core Principles

1.  **Environment Differentiation (`NODE_ENV`):** The `NODE_ENV` environment variable is fundamental. It dictates application behavior across `development`, `production`, and `test` environments. **Do not remove or bypass `NODE_ENV` checks.**
2.  **File-Based Configuration:** All environment-specific variables, especially sensitive ones, **must** be stored in `.env` files and **never** hardcoded or committed to version control.
3.  **Precedence and Security:** Values from `.env` files must always take precedence over shell environment variables. Sensitive credentials for tests should be sourced directly from files to avoid reliance on the shell environment.

## Implementation Details

### 1. `NODE_ENV` Usage

*   **Purpose:** `NODE_ENV` is used by various parts of the application (e.g., `server.js`, `src/config/database.js`, `helmet` middleware) to adapt behavior based on the current environment.
*   **Values:** Typically `development`, `production`, or `test`.
*   **Handling:**
    *   When running the main application (`npm start`, `npm run dev`), `NODE_ENV` is usually `undefined` or `development` (as set in `.env`).
    *   When running tests (`npm test`), Jest's setup ensures `NODE_ENV` is set to `test`.

### 2. `.env` Files

*   **`.env` (for Application):**
    *   **Location:** Project root (`/Users/olivier/dev/site-alumni/.env`).
    *   **Content:** Contains environment variables for `development` and `production` modes (e.g., `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `PORT`, `SESSION_SECRET`).
    *   **Version Control:** **Must be `.gitignore`d.**
    *   **Changes Made:**
        *   **`server.js`**: Modified the `dotenv.config()` call to `require('dotenv').config({ override: true });`.
        *   **Reason:** This ensures that any variables defined in `.env` will overwrite existing shell environment variables with the same name, guaranteeing that the values from the file are used. This applies when `NODE_ENV` is not `test`.

*   **`.env.test` (for Tests):**
    *   **Location:** Project root (`/Users/olivier/dev/site-alumni/.env.test`).
    *   **Content:** Contains environment variables specifically for the `test` environment (e.g., `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` for the test database).
    *   **Version Control:** **Must be `.gitignore`d.**
    *   **Changes Made:**
        *   **`tests/globalSetup.js`**: Modified the `dotenv.config()` call to `dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });`.
        *   **Reason:** This ensures that when Jest starts, the variables from `.env.test` are loaded into `process.env` and take precedence over any existing shell environment variables.

### 3. Database Credential Handling (Critical for Tests)

This is the **mandated and most critical part** of the parameter handling strategy, especially for sensitive database credentials in the test environment.

*   **`src/config/database.js`**:
    *   **Changes Made:**
        *   **Added Imports:** `const fs = require('fs');`, `const path = require('path');`, `const dotenv = require('dotenv');`.
        *   **Modified `createConnection` function:**
            ```javascript
            // Inside createConnection function
            if (process.env.NODE_ENV === 'test') {
              const envTestPath = path.resolve(__dirname, '../../.env.test');
              const envConfig = dotenv.parse(fs.readFileSync(envTestPath));
              dbPassword = envConfig.DB_PASSWORD;
              dbName = envConfig.DB_NAME || dbName;
              dbHost = envConfig.DB_HOST || dbHost;
              dbPort = envConfig.DB_PORT || dbPort;
              dbUser = envConfig.DB_USER || dbUser;
            }
            // ... rest of the function uses dbPassword, dbName, etc.
            ```
    *   **Reason:** This change ensures that when `NODE_ENV` is `test`, the `createConnection` function **directly reads and parses the `.env.test` file** to obtain `DB_PASSWORD` and other database connection details. This completely bypasses `process.env` for these specific variables in the test environment.
    *   **Benefit:** This makes the tests robust against scenarios where `DB_PASSWORD` might be explicitly unset or empty in the shell environment, as the value is always sourced from the `.env.test` file. This is a security best practice as it avoids relying on shell environment variables for sensitive data during testing.
    *   **For Non-Test Environments:** When `NODE_ENV` is not `test`, `createConnection` continues to rely on `process.env` (which is populated by `dotenv` from the main `.env` file, as configured in `server.js`).

### 4. Test Setup and Teardown

*   **`tests/integration/auth.test.js` (and other integration test files):**
    *   **Changes Made:** Removed the local `let connection;` declaration and implemented explicit `beforeEach` and `afterEach` blocks within the `describe` block to acquire, use, and release database connections and manage transactions.
    *   **Reason:** This ensures that each test has a fresh, isolated database state and cleans up after itself, preventing test interference. It also makes the test file self-contained regarding its database connection management.

*   **`jest.config.js`**:
    *   **Changes Made:** Added `'./tests/setupIntegrationTests.js'` to the `setupFilesAfterEnv` array.
    *   **Reason:** This ensures that the global `beforeEach` and `afterEach` hooks defined in `tests/setupIntegrationTests.js` (which manage database connections and transactions for integration tests) are executed by Jest for every integration test file.

## Summary of Parameter Flow

1.  **Application Run (`npm start`/`npm run dev`):**
    *   `server.js` checks `NODE_ENV`. If not `test`, it calls `dotenv.config({ override: true })`, loading variables from `.env` into `process.env`.
    *   `src/config/database.js` then reads database credentials from `process.env`.
    *   Other application code reads general variables from `process.env`.

2.  **Test Run (`npm test`):**
    *   Jest's `globalSetup.js` runs first, setting `NODE_ENV` to `test` and loading variables from `.env.test` into `process.env` using `dotenv.config({ path: ..., override: true })`.
    *   For database connections, `src/config/database.js` detects `NODE_ENV === 'test'` and **directly reads** `DB_PASSWORD` (and other DB credentials) from `.env.test` using `fs` and `dotenv.parse`, bypassing `process.env` for these specific values.
    *   Other test code and setup files (like `setupEachTestFile.js`, `setupIntegrationTests.js`) read general variables from `process.env`.

This comprehensive approach ensures that environment variables are handled securely, reliably, and consistently across all operational modes of the `site-alumni` project.