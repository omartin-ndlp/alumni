const request = require('supertest');
const app = require('../../server'); // Adjust this path if needed
const { getConnection, releaseConnection } = require('../../src/config/database');
const bcrypt = require('bcryptjs');

describe('User and Employer Routes', () => {
  let agent;
  let connection;

  beforeEach(async () => {
    agent = request.agent(app);
    connection = await getConnection();
    await connection.beginTransaction();
    global.__TEST_DB_CONNECTION__ = connection; // Share connection

    // Seed with test users
    const adminPassword = await bcrypt.hash('password', 10);
    const userPassword = await bcrypt.hash('password', 10);

    await connection.query(
        `INSERT INTO users (id, email, password_hash, prenom, nom, annee_diplome, section_id, is_admin, is_approved, is_active) VALUES
         (1, 'admin@test.com', ?, 'Admin', 'User', 2020, 1, TRUE, TRUE, TRUE),
         (2, 'user@test.com', ?, 'Regular', 'User', 2021, 2, FALSE, TRUE, TRUE)`,
        [adminPassword, userPassword]
    );

    // Seed with a test employer and employment record
    await connection.query(
      `INSERT INTO employers (id, nom, secteur, ville) VALUES (1, 'Test Employer', 'IT', 'Testville')`
    );
    await connection.query(
      `INSERT INTO user_employment (user_id, employer_id, poste, date_debut, is_current) VALUES (2, 1, 'Developer', '2022-01-01', TRUE)`
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
    it('should return the list of users for an authenticated admin', async () => {
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
    it('should return the list of employers', async () => {
      const res = await agent.get('/users/employers/list');
      expect(res.statusCode).toEqual(200);
      expect(res.text).toContain('Employeurs');
    });
  });

  describe('GET /users/employers/:id', () => {
    it('should return the details of a specific employer and its employees', async () => {
      const res = await agent.get('/users/employers/1');
      expect(res.statusCode).toEqual(200);
      expect(res.text).toContain('Test Employer');
      expect(res.text).toContain('Regular User'); // The employee
    });
  });
});
