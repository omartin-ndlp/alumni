const { getConnection, releaseConnection } = require('../../src/config/database');

describe('Auth Integration', () => {
  let connection;

  beforeEach(async () => {
    connection = await getConnection();
    await connection.beginTransaction();
  });

  afterEach(async () => {
    await connection.rollback();
    releaseConnection(connection);
  });
  

  test('should have a placeholder test', () => {
    expect(true).toBe(true);
  });

  test('should connect to the database and retrieve tables', async () => {
    const [rows] = await connection.query('SHOW TABLES');
    expect(rows.length).toBeGreaterThan(0);
  });

  test('should insert a new section and roll it back', async () => {
    const sectionName = 'Test Section for Rollback';
    await connection.query('INSERT INTO sections (nom) VALUES (?)', [sectionName]);

    // Verify the insertion within this transaction
    const [rows] = await connection.query('SELECT * FROM sections WHERE nom = ?', [sectionName]);
    expect(rows.length).toBe(1);
    expect(rows[0].nom).toBe(sectionName);
  });

  test('should confirm previous section insertion was rolled back', async () => {
    const sectionName = 'Test Section for Rollback';
    // This test runs after the previous one's rollback
    const [rows] = await connection.query('SELECT * FROM sections WHERE nom = ?', [sectionName]);
    expect(rows.length).toBe(0); // Expect 0 rows, confirming rollback
  });
});