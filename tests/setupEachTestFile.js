const { createConnection, getConnection, closeConnection, releaseConnection } = require('../src/config/database');

beforeAll(async () => {
  global.__TEST_DB_POOL__ = await createConnection(); // Create pool and assign to global

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