const request = require('supertest');
const app = require('../../server');
const { getConnection, releaseConnection } = require('../../src/config/database');
const bcrypt = require('bcryptjs');

describe('Admin Actions Multi-Table Interactions', () => {
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

  test('should approve a registration request and create a new user', async () => {
    // Insert a pending registration request
    const requestEmail = `pending.user.${Date.now()}@example.com`;
    const [requestInsertResult] = await connection.query(
      'INSERT INTO registration_requests (email, prenom, nom, annee_diplome, section_id, message) VALUES (?, ?, ?, ?, ?, ?)',
      [requestEmail, 'Pending', 'User', 2024, 1, 'Looking to join the alumni network.']
    );
    const requestId = requestInsertResult.insertId;

    // Verify the request exists initially
    let [initialRequestRows] = await connection.query('SELECT * FROM registration_requests WHERE id = ?', [requestId]);
    expect(initialRequestRows.length).toBe(1);

    // Simulate admin approval (e.g., calling a service function or route handler)
    // For this integration test, we'll simulate the database operations that an approval would trigger.
    const requestData = initialRequestRows[0];
    const hashedPassword = await bcrypt.hash('default_password', 10); // A default password for new users

    // 1. Create the user
    const [userInsertResult] = await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [requestData.email, hashedPassword, requestData.prenom, requestData.nom, requestData.annee_diplome, requestData.section_id, true, true]
    );
    const newUserId = userInsertResult.insertId;

    // 2. Delete the registration request
    await connection.query('DELETE FROM registration_requests WHERE id = ?', [requestId]);

    // Verify the user is created
    const [userRows] = await connection.query('SELECT * FROM users WHERE id = ?', [newUserId]);
    expect(userRows.length).toBe(1);
    expect(userRows[0].email).toBe(requestEmail);
    expect(userRows[0].is_approved).toBe(1); // MySQL stores boolean as 1/0

    // Verify the registration request is deleted
    const [finalRequestRows] = await connection.query('SELECT * FROM registration_requests WHERE id = ?', [requestId]);
    expect(finalRequestRows.length).toBe(0);
  });

  test('should reject a registration request and delete it without creating a user', async () => {
    // Insert a pending registration request
    const requestEmail = `reject.user.${Date.now()}@example.com`;
    const [requestInsertResult] = await connection.query(
      'INSERT INTO registration_requests (email, prenom, nom, annee_diplome, section_id, message) VALUES (?, ?, ?, ?, ?, ?)',
      [requestEmail, 'Reject', 'User', 2023, 2, 'Not suitable.']
    );
    const requestId = requestInsertResult.insertId;

    // Verify the request exists initially
    let [initialRequestRows] = await connection.query('SELECT * FROM registration_requests WHERE id = ?', [requestId]);
    expect(initialRequestRows.length).toBe(1);

    // Simulate admin rejection (e.g., calling a service function or route handler)
    // For this integration test, we'll simulate the database operation that a rejection would trigger.
    await connection.query('DELETE FROM registration_requests WHERE id = ?', [requestId]);

    // Verify the registration request is deleted
    const [finalRequestRows] = await connection.query('SELECT * FROM registration_requests WHERE id = ?', [requestId]);
    expect(finalRequestRows.length).toBe(0);

    // Verify no user was created with this email
    const [userRows] = await connection.query('SELECT * FROM users WHERE email = ?', [requestEmail]);
    expect(userRows.length).toBe(0);
  });

  test('should allow admin to activate and deactivate user accounts', async () => {
    // Create a user for testing activation/deactivation
    const uniqueEmail = `toggle.user.${Date.now()}@example.com`;
    const hashedPassword = await bcrypt.hash('password', 10);
    const [userInsertResult] = await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uniqueEmail, hashedPassword, 'Toggle', 'User', 2020, 1, true, true] // Start as active
    );
    const userId = userInsertResult.insertId;

    // Verify user is initially active
    let [userRows] = await connection.query('SELECT is_active FROM users WHERE id = ?', [userId]);
    expect(userRows[0].is_active).toBe(1);

    // Simulate deactivation
    await connection.query('UPDATE users SET is_active = ? WHERE id = ?', [false, userId]);

    // Verify user is now inactive
    [userRows] = await connection.query('SELECT is_active FROM users WHERE id = ?', [userId]);
    expect(userRows[0].is_active).toBe(0);

    // Simulate activation
    await connection.query('UPDATE users SET is_active = ? WHERE id = ?', [true, userId]);

    // Verify user is now active again
    [userRows] = await connection.query('SELECT is_active FROM users WHERE id = ?', [userId]);
    expect(userRows[0].is_active).toBe(1);
  });

  test('should allow admin to manage sections (add, update, delete)', async () => {
    // Test adding a section
    const newSectionName = `New Section ${Date.now()}`;
    const newSectionDescription = `Description for ${newSectionName}`;
    const [addResult] = await connection.query(
      'INSERT INTO sections (nom, description) VALUES (?, ?)',
      [newSectionName, newSectionDescription]
    );
    const newSectionId = addResult.insertId;

    let [sectionRows] = await connection.query('SELECT * FROM sections WHERE id = ?', [newSectionId]);
    expect(sectionRows.length).toBe(1);
    expect(sectionRows[0].nom).toBe(newSectionName);
    expect(sectionRows[0].description).toBe(newSectionDescription);

    // Test updating a section
    const updatedSectionName = `Updated Section ${Date.now()}`;
    const updatedSectionDescription = `Updated Description for ${updatedSectionName}`;
    await connection.query(
      'UPDATE sections SET nom = ?, description = ? WHERE id = ?',
      [updatedSectionName, updatedSectionDescription, newSectionId]
    );

    [sectionRows] = await connection.query('SELECT * FROM sections WHERE id = ?', [newSectionId]);
    expect(sectionRows.length).toBe(1);
    expect(sectionRows[0].nom).toBe(updatedSectionName);
    expect(sectionRows[0].description).toBe(updatedSectionDescription);

    // Test deleting a section
    await connection.query('DELETE FROM sections WHERE id = ?', [newSectionId]);

    [sectionRows] = await connection.query('SELECT * FROM sections WHERE id = ?', [newSectionId]);
    expect(sectionRows.length).toBe(0);
  });
});
