const { createConnection, getConnection, closeConnection, releaseConnection } = require('../src/config/database');

const isIntegrationTest = (testPath) => testPath.includes('tests/integration/');

beforeAll(async () => {
  console.log('Starting beforeAll in setupEachTestFile.js');
  if (isIntegrationTest(expect.getState().testPath)) {
    console.log('Integration test detected. Setting up database pool.');
    global.__TEST_DB_POOL__ = await createConnection(); // Create pool and assign to global
  }
  console.log('Finished beforeAll in setupEachTestFile.js');
});

afterAll(async () => {
  if (isIntegrationTest(expect.getState().testPath)) {
    await closeConnection(); // Close global pool
  }
});

