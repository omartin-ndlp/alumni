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
