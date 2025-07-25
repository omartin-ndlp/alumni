const request = require('supertest');
const initApp = require('../../server'); // Use initApp to create a fresh app for testing
const { getConnection, releaseConnection } = require('../../src/config/database');
const bcrypt = require('bcryptjs');
const User = require('../../src/models/User'); // Import User model

describe('End-to-End Authentication Flow', () => {
  let connection;
  let app;
  let server;

  beforeAll((done) => {
    app = initApp();
    server = app.listen(done); // Start server on a random available port
  });

  afterAll((done) => {
    server.close(done); // Ensure server is closed after all tests
  });

  beforeEach(async () => {
    connection = await getConnection();
    await connection.beginTransaction();
    global.__TEST_DB_CONNECTION__ = connection; // Store connection globally for test environment
  });

  afterEach(async () => {
    await connection.rollback();
    if (connection === global.__TEST_DB_CONNECTION__) {
      global.__TEST_DB_CONNECTION__ = null; // Clear global connection only if it's the one we set
    }
    releaseConnection(connection);
  });

  test('should allow a user to register successfully', async () => {
    const email = `register_${Date.now()}@example.com`;
    const password = 'password123';
    const prenom = 'Test';
    const nom = 'User';
    const annee_diplome = 2023;
    const section_id = 1; // Assuming section_id 1 exists

    const res = await request(server) // Test against the running server
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

    const res = await request(server) // Test against the running server
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

    const agent = request.agent(server); // Create an agent to maintain session

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
    const res = await request(server).get('/dashboard'); // Test against the running server

    expect(res.statusCode).toEqual(302); // Expect redirect
    expect(res.headers.location).toContain('/login'); // Redirect to login page
  });
});