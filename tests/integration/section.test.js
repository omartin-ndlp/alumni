const { getConnection, releaseConnection } = require('../../src/config/database');

describe('Section Table Database Interactions', () => {
  let connection;

  beforeEach(async () => {
    connection = await getConnection();
    await connection.beginTransaction();
  });

  afterEach(async () => {
    await connection.rollback();
    if (connection === global.__TEST_DB_CONNECTION__) {
      global.__TEST_DB_CONNECTION__ = null; // Clear global connection only if it's the one we set
    }
    releaseConnection(connection);
  });

  test('should create and retrieve a new section', async () => {
    const sectionName = `Test Section ${Date.now()}`;
    const [insertResult] = await connection.query(
      'INSERT INTO sections (nom) VALUES (?)',
      [sectionName]
    );
    const sectionId = insertResult.insertId;

    const [rows] = await connection.query('SELECT * FROM sections WHERE id = ?', [sectionId]);
    expect(rows.length).toBe(1);
    expect(rows[0].nom).toBe(sectionName);
  });
});