const { getConnection, releaseConnection } = require('../../src/config/database');

describe('Database Connection Management', () => {
  it('should get a connection from the pool successfully', async () => {
    // global.__TEST_DB_POOL__ is initialized by globalSetup.js
    const connection = await getConnection();
    expect(connection).toBeDefined();
    expect(typeof connection.release).toBe('function');
    releaseConnection(connection);
  });

  it('should throw an error if trying to get connection before pool is initialized', async () => {
    // Temporarily unset global.__TEST_DB_POOL__ for this specific test
    const tempPool = global.__TEST_DB_POOL__;
    global.__TEST_DB_POOL__ = undefined;
    await expect(getConnection()).rejects.toThrow('Base de données non initialisée. Appelez createConnection() d\'abord.');
    global.__TEST_DB_POOL__ = tempPool; // Restore for subsequent tests
  });

  it('should handle releasing a null connection gracefully', () => {
    expect(() => releaseConnection(null)).not.toThrow();
  });
});
