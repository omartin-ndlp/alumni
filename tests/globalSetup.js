require('dotenv').config({ path: '.env.test', override: true });

const { createConnection } = require('../src/config/database');
const { main: runMigrations } = require('../scripts/migrate');

module.exports = async () => {
  console.log('Global Setup: Setting up test database and connection pool...');
  await runMigrations();
  await createConnection(); // Create the global connection pool
  console.log('Global Setup: Test database and connection pool ready.');
};