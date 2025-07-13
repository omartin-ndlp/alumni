require('dotenv').config({ path: '.env.test', override: true });

console.log('--- GLOBAL SETUP SCRIPT STARTED ---');

const { createConnection } = require('../src/config/database');
const { main: runMigrations, dropDatabase, seedCommonData } = require('../scripts/migrate.js');

module.exports = async () => {
  dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });
  process.env.NODE_ENV = 'test';
};
  try {
    console.log('--- GLOBAL SETUP: Inside async function ---');
    console.log(`DB_HOST: ${process.env.DB_HOST}, DB_NAME: ${process.env.DB_NAME}`);

    console.log('Dropping existing database (if any)...');
    await dropDatabase();
    console.log('Database dropped.');

    console.log('Running migrations...');
    await runMigrations();
    console.log('Migrations finished successfully.');

    console.log('Creating connection pool...');
    await createConnection(); // This now directly sets global.__TEST_DB_POOL__
    console.log('Connection pool created successfully.');

    if (global.__TEST_DB_POOL__) {
      console.log('global.__TEST_DB_POOL__ has been set.');
    } else {
      console.error('!!! CRITICAL: global.__TEST_DB_POOL__ was NOT set after creation. !!!');
    }

    console.log('--- GLOBAL SETUP END ---');
  } catch (error) {
    console.error('!!!!!! GLOBAL SETUP FAILED !!!!!!');
    console.error(error);
    // Ensure the process exits with an error code to halt Jest
    process.exit(1);
  }
};