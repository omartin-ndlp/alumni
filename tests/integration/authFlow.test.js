const request = require('supertest');
const app = require('../../server'); // Assuming your Express app is exported from server.js
const { getConnection, releaseConnection } = require('../../src/config/database');
const bcrypt = require('bcryptjs');
const User = require('../../src/models/User'); // Import User model

describe('End-to-End Authentication Flow', () => {
  let connection;

  beforeEach(async () => {
    connection = await getConnection();
    await connection.beginTransaction();
    global.__TEST_DB_CONNECTION__ = connection; // Store connection globally for test environment
  });

  afterEach(async () => {
    await connection.rollback();
    releaseConnection(connection);
    global.__TEST_DB_CONNECTION__ = null; // Clear global connection
  });

  test('should allow a user to register successfully', async () => {
    const email = `register_${Date.now()}@example.com`;
    const password = 'password123';
    const prenom = 'Test';
    const nom = 'User';
    const annee_diplome = 2023;
    const section_id = 1; // Assuming section_id 1 exists

    const res = await request(app)
      .post('/register')
      .send({
        email,
        password,
        confirm_password: password,
        prenom,
        nom,
        annee_diplome,
        section_id,
        message: 'Hello'
      });

    expect(res.statusCode).toEqual(302); // Expect redirect on success
    expect(res.headers.location).toEqual('/register-success');

    // Verify registration request is in the database
    const [rows] = await connection.query('SELECT * FROM registration_requests WHERE email = ?', [email]);
    expect(rows.length).toBe(1);
    expect(rows[0].email).toBe(email);
    // No password hash to check in registration_requests
  });

  test('should allow a user to log in successfully after approval', async () => {
    const email = `login_${Date.now()}@example.com`;
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Manually insert and approve user for login
    await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, 'Login', 'User', 2022, 1, true, true]
    );

    const res = await request(app)
      .post('/login')
      .send({ email, password });

    expect(res.statusCode).toEqual(302); // Expect redirect on success
    expect(res.headers.location).toEqual('/dashboard'); // Redirect to dashboard after login

    // Verify session cookie is set (presence of Set-Cookie header)
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/^connect.sid=/);
  });

  test('should allow a logged-in user to log out successfully', async () => {
    const email = `logout_${Date.now()}@example.com`;
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Manually insert and approve user for login
    await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, 'Logout', 'User', 2022, 1, true, true]
    );

    const agent = request.agent(app);

    // First, log in the user using the agent
    const loginRes = await agent
      .post('/login')
      .send({ email, password });

    expect(loginRes.statusCode).toEqual(302); // Expect redirect on success
    expect(loginRes.headers.location).toEqual('/dashboard');

    // Now, attempt to log out using the agent
    const logoutRes = await agent
      .post('/logout');

    expect(logoutRes.statusCode).toEqual(302); // Expect redirect on success
    expect(logoutRes.headers.location).toEqual('/login'); // Redirect to login page after logout

    // After logout, try to access a protected route and expect redirect to login
    const protectedRes = await agent.get('/dashboard');
    expect(protectedRes.statusCode).toEqual(302);
    expect(protectedRes.headers.location).toContain('/login');
  });

  test('should redirect unauthenticated users from protected routes', async () => {
    // Attempt to access a protected route (e.g., /dashboard) without authentication
    const res = await request(app).get('/dashboard');

    expect(res.statusCode).toEqual(302); // Expect redirect
    expect(res.headers.location).toContain('/login'); // Redirect to login page
  });

  afterAll(async () => {
    // Close the server if it was started
    if (app.server && app.server.close) {
      await new Promise(resolve => app.server.close(resolve));
    }
  });
});