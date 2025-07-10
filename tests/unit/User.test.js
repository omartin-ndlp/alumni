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
      INSERT INTO users (nom, prenom, email, password_hash, annee_diplome, section_id, is_approved, is_active, is_admin)
      VALUES ('Test', 'User', 'test@example.com', 'password', 2023, 1, TRUE, TRUE, FALSE)
    `);
    // Seed the database with an admin user
    await db.execute(`
      INSERT INTO users (nom, prenom, email, password_hash, annee_diplome, section_id, is_approved, is_active, is_admin)
      VALUES ('Admin', 'User', 'admin@example.com', 'password', 2020, 1, TRUE, TRUE, TRUE)
    `);
  });

  it('should find a user by email', async () => {
    const user = await User.findByEmail('test@example.com');
    expect(user).not.toBeNull();
    expect(user.email).toBe('test@example.com');
  });

  it('should filter out admin users by default in getAll', async () => {
    const users = await User.getAll({});
    const adminUser = users.find(u => u.email === 'admin@example.com');
    expect(adminUser).toBeUndefined();
  });

  it('should include admin users when show_admins is true in getAll', async () => {
    const users = await User.getAll({ show_admins: true });
    const adminUser = users.find(u => u.email === 'admin@example.com');
    expect(adminUser).not.toBeUndefined();
    expect(adminUser.email).toBe('admin@example.com');
  });
});