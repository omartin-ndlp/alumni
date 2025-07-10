require('dotenv').config({ path: '.env.test', override: true });
console.log('DB_NAME from setup.js:', process.env.DB_NAME);
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