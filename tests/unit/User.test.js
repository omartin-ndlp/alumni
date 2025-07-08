const User = require('../../src/models/User');
const { getConnection } = require('../../src/config/database');

describe('User Model', () => {
  let db;

  beforeAll(() => {
    db = getConnection();
  });

  beforeEach(async () => {
    // Clean the users table before each test
    await db.execute('DELETE FROM users');
    // Seed the database with a test user
    await db.execute(`
      INSERT INTO users (nom, prenom, email, password_hash, annee_diplome, section_id, is_approved, is_active)
      VALUES ('Test', 'User', 'test@example.com', 'password', 2023, 1, TRUE, TRUE)
    `);
  });

  it('should find a user by email', async () => {
    const user = await User.findByEmail('test@example.com');
    expect(user).not.toBeNull();
    expect(user.email).toBe('test@example.com');
  });
});