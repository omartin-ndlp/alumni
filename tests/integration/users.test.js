const request = require('supertest');
const initApp = require('../../server'); // Adjust this path if needed
const { getConnection, releaseConnection } = require('../../src/config/database');
const bcrypt = require('bcryptjs');

describe('User and Employer Routes', () => {
  let agent;
  let connection;
  let app;
  let server;

  beforeAll((done) => {
    app = initApp();
    server = app.listen(done);
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(async () => {
    agent = request.agent(server);
    connection = await getConnection();
    await connection.beginTransaction();
    global.__TEST_DB_CONNECTION__ = connection; // Share connection

    // Seed with test users
    const adminPassword = await bcrypt.hash('password', 10);
    const userPassword = await bcrypt.hash('password', 10);

    await connection.query(
      `INSERT INTO users (id, email, password_hash, prenom, nom, annee_diplome, section_id, is_admin, is_approved, is_active) VALUES
         (1, 'admin@test.com', ?, 'Admin', 'User', 2020, 1, TRUE, TRUE, TRUE),
         (2, 'user@test.com', ?, 'Regular', 'User', 2021, 2, FALSE, TRUE, TRUE),
         (3, 'anotheruser@test.com', ?, 'Another', 'User', 2022, 1, FALSE, TRUE, TRUE)`,
      [adminPassword, userPassword, userPassword]
    );

    // Seed with a test employer and employment record
    await connection.query(
      `INSERT INTO employers (id, nom, secteur, ville) VALUES (1, 'Test Employer', 'IT', 'Testville')`
    );
    await connection.query(
      `INSERT INTO user_employment (user_id, employer_id, poste, date_debut, is_current) VALUES
        (2, 1, 'Junior Developer', '2021-01-01', FALSE),
        (2, 1, 'Senior Developer', '2022-01-01', TRUE),
        (3, 1, 'QA Engineer', '2023-01-01', TRUE)`
    );

    // Log in as the admin user for the test session
    await agent
      .post('/login')
      .send({ email: 'admin@test.com', password: 'password' });
  });

  afterEach(async () => {
    await connection.rollback();
    if (global.__TEST_DB_CONNECTION__ === connection) {
      global.__TEST_DB_CONNECTION__ = null; // Clear global connection
    }
    releaseConnection(connection);
  });

  afterAll(async () => {
    if (agent && agent.server && agent.server.close) {
      await new Promise(resolve => agent.server.close(resolve));
    }
  });

  describe('GET /users', () => {
    it('should return the list of users for an authenticated user', async () => {
      const res = await agent.get('/users');
      expect(res.statusCode).toEqual(200);
      expect(res.text).toContain('Annuaire des anciens');
    });

    it('should redirect an unauthenticated user to the login page', async () => {
      // Create a new agent that is not logged in
      const unauthenticatedAgent = request.agent(app);
      const res = await unauthenticatedAgent.get('/users');
      expect(res.statusCode).toEqual(302);
      expect(res.headers.location).toBe('/login?redirect=%2Fusers');
    });
  });

  describe('GET /users/api/users', () => {
    it('should return a JSON list of users for an authenticated admin', async () => {
      const res = await agent.get('/users/api/users');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('users');
      expect(res.body).toHaveProperty('pagination');
    });

    it('should return a 302 for an unauthenticated user', async () => {
      const unauthenticatedAgent = request.agent(app);
      const res = await unauthenticatedAgent.get('/users/api/users');
      expect(res.statusCode).toEqual(302);
    });
  });

  describe('GET /users/:id', () => {
    it('should return the profile of a specific user', async () => {
      const res = await agent.get('/users/2'); // Assuming user with ID 2 exists
      expect(res.statusCode).toEqual(200);
      expect(res.text).toContain('Regular User');
    });

    it('should return a 404 for a non-existent user', async () => {
      const res = await agent.get('/users/9999');
      expect(res.statusCode).toEqual(404);
    });
  });

  describe('GET /users/employers/list', () => {
    it('should return the list of employers with correct unique employee count', async () => {
      const res = await agent.get('/users/employers/list');
      expect(res.statusCode).toEqual(200);
      expect(res.text).toContain('Employeurs');
      // Expect 2 unique employees for 'Test Employer' (user 2 and user 3)
      expect(res.text).toContain('Test Employer (2)');
    });
  });

  describe('GET /users/:id - Profile Edit Button Visibility', () => {
    let regularUserAgent;

    beforeEach(async () => {
      // Log in as a regular user for these tests
      regularUserAgent = request.agent(app);
      await regularUserAgent
        .post('/login')
        .send({ email: 'user@test.com', password: 'password' });
    });

    it(`should show "Modifier le profil" button to an admin viewing any user's profile`, async () => {
      // Admin agent is already logged in from the main beforeEach
      const res = await agent.get('/users/2'); // Admin viewing regular user's profile
      expect(res.statusCode).toEqual(200);
      expect(res.text).toContain('Modifier le profil');
      expect(res.text).toContain('href="/admin/users/edit/2"');
    });

    it(`should show "Modifier le profil" button to a regular user viewing their own profile`, async () => {
      const res = await regularUserAgent.get('/users/2'); // Regular user viewing their own profile
      expect(res.statusCode).toEqual(200);
      expect(res.text).toContain('Modifier le profil');
    });

    it(`should NOT show "Modifier le profil" button to a regular user viewing another user's profile`, async () => {
      const res = await regularUserAgent.get('/users/3'); // Regular user viewing another user's profile
      expect(res.statusCode).toEqual(200);
      expect(res.text).not.toContain('Modifier le profil');
    });
  });
});
