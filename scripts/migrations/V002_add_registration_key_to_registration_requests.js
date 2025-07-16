module.exports = {
  async up(connection) {
    await connection.execute(`
      ALTER TABLE registration_requests
      ADD COLUMN IF NOT EXISTS registration_key VARCHAR(255) UNIQUE NULL
    `);
    await connection.execute(`
      ALTER TABLE registration_requests
      ADD COLUMN IF NOT EXISTS key_generated_at TIMESTAMP NULL
    `);
  }
};