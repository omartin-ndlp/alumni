require('dotenv').config({ path: '.env.test' });
const { createConnection, getConnection } = require('../src/config/database');

beforeAll(async () => {
  await createConnection();
});

afterAll(async () => {
  const db = getConnection();
  if (db) {
    await db.end();
  }
});