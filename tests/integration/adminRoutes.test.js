const request = require('supertest');
const initApp = require('../../server');
const { getConnection, releaseConnection } = require('../../src/config/database');
const bcrypt = require('bcryptjs');
const i18n = require('i18n');
const path = require('path');

describe('Admin Routes', () => {
  let app;
  let server;
  let connection;
  let adminAgent;
  let regularUserAgent;
  let adminUser;
  let regularUser;

  beforeAll((done) => {
    app = initApp();

    // Initialize i18n for testing
    i18n.configure({
      locales: ['fr', 'en'],
      directory: path.join(__dirname, '../../src/locales'),
      defaultLocale: 'fr',
      objectNotation: true,
      updateFiles: false,
    });
    app.use(i18n.init);
    app.use((req, res, next) => {
      res.locals.__ = res.__;
      next();
    });

    server = app.listen(done);
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(async () => {
    connection = await getConnection();
    await connection.beginTransaction();
    global.__TEST_DB_CONNECTION__ = connection;

    // Clean up tables before each test to ensure isolation
    await connection.execute("SET FOREIGN_KEY_CHECKS = 0;");
    await connection.execute("TRUNCATE TABLE users;");
    await connection.execute("TRUNCATE TABLE sections;");
    await connection.execute("TRUNCATE TABLE registration_requests;");
    await connection.execute("TRUNCATE TABLE employers;");
    await connection.execute("TRUNCATE TABLE user_employment;");
    await connection.execute("SET FOREIGN_KEY_CHECKS = 1;");

    // Seed data: sections
    await connection.execute("INSERT INTO sections (id, nom) VALUES (1, 'SN IR'), (2, 'CIEL IR');");

    // Create admin user
    const adminPassword = await bcrypt.hash('adminpass', 10);
    await connection.execute(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['admin@test.com', adminPassword, 'Admin', 'User', 2020, 1, true, true, true]
    );
    const [adminRows] = await connection.execute('SELECT * FROM users WHERE email = ?', ['admin@test.com']);
    adminUser = adminRows[0];

    // Create regular user
    const userPassword = await bcrypt.hash('userpass', 10);
    await connection.execute(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['user@test.com', userPassword, 'Regular', 'User', 2021, 2, true, true, false]
    );
    const [userRows] = await connection.execute('SELECT * FROM users WHERE email = ?', ['user@test.com']);
    regularUser = userRows[0];

    // Log in admin user
    adminAgent = request.agent(server);
    await adminAgent.post('/login').send({ email: 'admin@test.com', password: 'adminpass' });

    // Log in regular user
    regularUserAgent = request.agent(server);
    await regularUserAgent.post('/login').send({ email: 'user@test.com', password: 'userpass' });
  });

  afterEach(async () => {
    await connection.rollback();
    if (connection === global.__TEST_DB_CONNECTION__) {
      global.__TEST_DB_CONNECTION__ = null; // Clear global connection only if it's the one we set
    }
    releaseConnection(connection);
  });

  // Access Control Tests
  const adminRoutes = [
    '/admin',
    '/admin/requests',
    '/admin/sections',
    '/admin/statistics',
    '/admin/export/employers',
  ];

  adminRoutes.forEach(route => {
    it(`should redirect non-admin users from ${route} to login`, async () => {
      const res = await regularUserAgent.get(route);
      expect(res.statusCode).toEqual(403); // Forbidden
      expect(res.text).toContain('Accès refusé - Droits administrateur requis');
    });

    it(`should allow admin users to access ${route}`, async () => {
      const res = await adminAgent.get(route);
      expect(res.statusCode).toEqual(200);
    });
  });

  // Add more specific tests for each admin functionality here

  describe('Registration Request Management', () => {
    let pendingRequestId;

    beforeEach(async () => {
      // Create a pending registration request for each test
      const [result] = await connection.execute(
        'INSERT INTO registration_requests (email, prenom, nom, annee_diplome, section_id) VALUES (?, ?, ?, ?, ?)',
        ['pending@example.com', 'Pending', 'User', 2022, 1]
      );
      pendingRequestId = result.insertId;
    });

    it('should allow an admin to approve a registration request', async () => {
      const res = await adminAgent.post(`/admin/requests/${pendingRequestId}/approve`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.key).toBeDefined();

      // Verify user is NOT created immediately and request is NOT deleted
      const [users] = await connection.execute('SELECT * FROM users WHERE email = ?', ['pending@example.com']);
      expect(users.length).toBe(0);

      const [requests] = await connection.execute('SELECT * FROM registration_requests WHERE id = ?', [pendingRequestId]);
      expect(requests.length).toBe(1);
    });

    it('should allow an admin to reject a registration request', async () => {
      const res = await adminAgent.post(`/admin/requests/${pendingRequestId}/reject`);
      expect(res.statusCode).toEqual(302);
      expect(res.headers.location).toEqual('/admin/requests?success=rejected');

      // Verify request is deleted and no user is created
      const [users] = await connection.execute('SELECT * FROM users WHERE email = ?', ['pending@example.com']);
      expect(users.length).toBe(0);

      const [requests] = await connection.execute('SELECT * FROM registration_requests WHERE id = ?', [pendingRequestId]);
      expect(requests.length).toBe(0);
    });

    it('should return 404 if approving a non-existent request', async () => {
      const res = await adminAgent.post('/admin/requests/9999/approve');
      expect(res.statusCode).toEqual(404); // Updated expected status code
      expect(res.body.success).toBe(false);
      expect(res.body.error).toEqual('Request not found'); // Updated expected error message
    });

    it('should return 302 if rejecting a non-existent request', async () => {
      const res = await adminAgent.post('/admin/requests/9999/reject');
      expect(res.statusCode).toEqual(302);
      expect(res.headers.location).toEqual('/admin/requests?error=reject_failed');
    });
  });
});