const { getConnection, releaseConnection } = require('../src/config/database');

const isIntegrationTest = (testPath) => testPath.includes('tests/integration/');

// Increase Jest timeout for hooks
jest.setTimeout(30000);

beforeAll(async () => {
  if (isIntegrationTest(expect.getState().testPath)) {
    console.time('db_setup');
    // Ensure the test database is clean before running tests
    const connection = await getConnection();
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('TRUNCATE TABLE users');
    await connection.query('TRUNCATE TABLE employers');
    await connection.query('TRUNCATE TABLE sections');
    await connection.query('TRUNCATE TABLE user_employment');
    await connection.query('TRUNCATE TABLE registration_requests');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    releaseConnection(connection);

    // Seed sections table as they are often foreign keys
    const seedConnection = await getConnection();
    await seedConnection.query("INSERT INTO sections (id, nom) VALUES (1, 'SN IR'), (2, 'SN ER'), (3, 'CIEL IR'), (4, 'CIEL ER') ON DUPLICATE KEY UPDATE nom=VALUES(nom)");
    releaseConnection(seedConnection);
    console.timeEnd('db_setup');
  }
});

afterAll(async () => {
  // No need to close connection here, it's handled by globalTeardown.js
});

