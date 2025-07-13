const { createConnection, getConnection, closeConnection, releaseConnection } = require('../src/config/database');

beforeAll(async () => {
  global.__TEST_DB_POOL__ = await createConnection(); // Create pool and assign to global
});

afterAll(async () => {
  await closeConnection(); // Close global pool
});

let connection; // Local connection for each test

beforeEach(async () => {
  connection = await getConnection(); // Get connection from global pool
  await connection.beginTransaction();
});

afterEach(async () => {
  await connection.rollback();
  releaseConnection(connection);
});