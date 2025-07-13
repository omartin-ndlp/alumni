const { createConnection, closeConnection, getConnection, releaseConnection } = require('../../src/config/database');
const User = require('../../src/models/User');
const bcrypt = require('bcryptjs');

describe('User Model Database Interactions', () => {
  test('should create a new user in the database', async () => {
    const uniqueEmail = `new.user.${Date.now()}@example.com`;
    const userData = {
      email: uniqueEmail,
      password: 'securepassword',
      prenom: 'New',
      nom: 'User',
      annee_diplome: 2023,
      section_id: 1,
      is_approved: true
    };

    const createdUser = await User.create(userData, connection); // Pass the connection
    expect(createdUser).toHaveProperty('id');
    expect(createdUser.email).toBe(userData.email);

    // Direct verification: Check if user exists in DB via direct query
    const [rows] = await connection.query('SELECT * FROM users WHERE id = ?', [createdUser.id]);
    expect(rows.length).toBe(1);
    expect(rows[0].email).toBe(userData.email);
    expect(await bcrypt.compare(userData.password, rows[0].password_hash)).toBe(true);
  });

  test('should retrieve a user by ID from the database', async () => {
    const uniqueEmail = `find.user.${Date.now()}@example.com`;
    const hashedPassword = await bcrypt.hash('password', 10);
    const [insertResult] = await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uniqueEmail, hashedPassword, 'Find', 'User', 2022, 1, true]
    );
    const userId = insertResult.insertId;

    // Direct verification: Check if user exists in DB via direct query before calling findById
    const [preCheckRows] = await connection.query('SELECT * FROM users WHERE id = ?', [userId]);
    expect(preCheckRows.length).toBe(1);

    const foundUser = await User.findById(userId, connection); // Pass the connection
    expect(foundUser).not.toBeNull();
    expect(foundUser.email).toBe(uniqueEmail);
    expect(foundUser).toHaveProperty('id', userId);
  });
});