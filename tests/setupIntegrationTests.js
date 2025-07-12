require('dotenv').config({ path: '.env.test' });
const { main: runMigrations } = require('../scripts/migrate');

module.exports = async () => {
  console.log('Setting up test database...');
  await runMigrations();
  console.log('Test database setup complete.');
};