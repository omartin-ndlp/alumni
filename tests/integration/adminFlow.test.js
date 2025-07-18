const request = require('supertest');
const app = require('../../server');
const { getConnection, releaseConnection } = require('../../src/config/database');
const bcrypt = require('bcryptjs');
const User = require('../../src/models/User');

describe('End-to-End Admin Functionality Flow', () => {
  let connection;
  let adminAgent; // supertest agent for maintaining admin session
  let adminEmail;
  let adminPassword;
  let adminId;

  beforeEach(async () => {
    connection = await getConnection();
    await connection.beginTransaction();
    global.__TEST_DB_CONNECTION__ = connection; // For transactional isolation

    // Create and log in an admin user for each test
    adminEmail = `admin_${Date.now()}@example.com`;
    adminPassword = 'adminpassword';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const [adminResult] = await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_admin, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [adminEmail, hashedPassword, 'Admin', 'User', 2010, 1, true, true, true]
    );
    adminId = adminResult.insertId;

    adminAgent = request.agent(app);
    await adminAgent.post('/login').send({ email: adminEmail, password: adminPassword });
  });

  afterEach(async () => {
    await connection.rollback();
    if (connection === global.__TEST_DB_CONNECTION__) {
      global.__TEST_DB_CONNECTION__ = null; // Clear global connection only if it's the one we set
    }
    releaseConnection(connection);
  });

  afterAll(async () => {
    // Close the server if it was started by supertest
    if (adminAgent && adminAgent.server && adminAgent.server.close) {
      await new Promise(resolve => adminAgent.server.close(resolve));
    }
  });

  test('should allow an admin to log in successfully', async () => {
    // This test is implicitly covered by beforeEach, but we can add a simple assertion
    const res = await adminAgent.get('/dashboard');
    expect(res.statusCode).toEqual(200); // Should be redirected to dashboard and see it
  });

  test('should allow an admin to approve a registration request', async () => {
    // Setup: Create a pending registration request
    const userEmail = `pending_user_${Date.now()}@example.com`;
    const [requestResult] = await connection.query(
      'INSERT INTO registration_requests (email, prenom, nom, annee_diplome, section_id, message) VALUES (?, ?, ?, ?, ?, ?)',
      [userEmail, 'Pending', 'User', 2023, 1, 'Please approve me']
    );
    const requestId = requestResult.insertId;

    // Action: Admin approves the request by generating a key
    const res = await adminAgent.post(`/admin/requests/${requestId}/approve`);

    expect(res.statusCode).toEqual(200); // Expect OK
    expect(res.body.success).toBe(true);
    expect(res.body.key).toBeDefined();

    // Verify the request is still in registration_requests but now has a key
    const [updatedRequest] = await connection.query('SELECT * FROM registration_requests WHERE id = ?', [requestId]);
    expect(updatedRequest.length).toBe(1);
    expect(updatedRequest[0].registration_key).toBe(res.body.key);
    expect(updatedRequest[0].key_generated_at).toBeDefined();

    // Verify that NO user has been created yet
    const [approvedUser] = await connection.query('SELECT * FROM users WHERE email = ?', [userEmail]);
    expect(approvedUser.length).toBe(0);
  });

  test('should allow an admin to reject a registration request', async () => {
    // Setup: Create a pending registration request
    const userEmail = `reject_user_${Date.now()}@example.com`;
    const [requestResult] = await connection.query(
      'INSERT INTO registration_requests (email, prenom, nom, annee_diplome, section_id, message) VALUES (?, ?, ?, ?, ?, ?)',
      [userEmail, 'Reject', 'User', 2024, 1, 'Please reject me']
    );
    const requestId = requestResult.insertId;

    // Action: Admin rejects the request
    const res = await adminAgent.post(`/admin/requests/${requestId}/reject`);

    expect(res.statusCode).toEqual(302); // Expect redirect
    expect(res.headers.location).toContain('/admin/requests');

    // Verify the request is deleted from registration_requests
    const [deletedRequest] = await connection.query('SELECT * FROM registration_requests WHERE id = ?', [requestId]);
    expect(deletedRequest.length).toBe(0);

    // Verify no user is created in the users table
    const [rejectedUser] = await connection.query('SELECT * FROM users WHERE email = ?', [userEmail]);
    expect(rejectedUser.length).toBe(0);
  });

  

  test('should allow an admin to manage sections (add, update, delete)', async () => {
    // Test adding a section
    const newSectionName = `New Section ${Date.now()}`;
    const newSectionDescription = `Description for ${newSectionName}`;
    const addRes = await adminAgent.post('/admin/sections/add').send({
      nom: newSectionName,
      description: newSectionDescription,
    });

    expect(addRes.statusCode).toEqual(302); // Expect redirect
    expect(addRes.headers.location).toContain('/admin/sections');

    // Verify section is added in the database
    const [addedSection] = await connection.query('SELECT * FROM sections WHERE nom = ?', [newSectionName]);
    expect(addedSection.length).toBe(1);
    const sectionId = addedSection[0].id;

    // Test updating a section
    const updatedSectionName = `Updated Section ${Date.now()}`;
    const updatedSectionDescription = `Updated Description for ${updatedSectionName}`;
    const updateRes = await adminAgent.post(`/admin/sections/${sectionId}/edit`).send({
      nom: updatedSectionName,
      description: updatedSectionDescription,
    });

    expect(updateRes.statusCode).toEqual(302); // Expect redirect
    expect(updateRes.headers.location).toContain('/admin/sections');

    // Verify section is updated in the database
    const [updatedSection] = await connection.query('SELECT * FROM sections WHERE id = ?', [sectionId]);
    expect(updatedSection.length).toBe(1);
    expect(updatedSection[0].nom).toBe(updatedSectionName);

    // Test deleting a section
    const deleteRes = await adminAgent.post(`/admin/sections/${sectionId}/delete`);

    expect(deleteRes.statusCode).toEqual(302); // Expect redirect
    expect(deleteRes.headers.location).toContain('/admin/sections');

    // Verify section is deleted from the database
    const [deletedSection] = await connection.query('SELECT * FROM sections WHERE id = ?', [sectionId]);
    expect(deletedSection.length).toBe(0);
  });
});