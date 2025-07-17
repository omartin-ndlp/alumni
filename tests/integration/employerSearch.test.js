const request = require('supertest');
const app = require('../../server');
const { getConnection, releaseConnection } = require('../../src/config/database');
const bcrypt = require('bcryptjs');

describe('GET /api/employers/search', () => {
  let agent;
  let connection;

  beforeEach(async () => {
    agent = request.agent(app);
    connection = await getConnection();
    await connection.beginTransaction();
    global.__TEST_DB_CONNECTION__ = connection;

    // Seed with a test user
    const userPassword = await bcrypt.hash('password', 10);
    await connection.query(
      `INSERT INTO users (id, email, password_hash, prenom, nom, annee_diplome, section_id, is_admin, is_approved, is_active) VALUES
         (1, 'user@test.com', ?, 'Test', 'User', 2021, 1, FALSE, TRUE, TRUE)`,
      [userPassword]
    );

    // Seed with test employers
    await connection.query(
      `INSERT INTO employers (id, nom, secteur, ville) VALUES
         (1, 'Stark Industries', 'Technology', 'New York'),
         (2, 'Wayne Enterprises', 'Technology', 'Gotham'),
         (3, 'Cyberdyne Systems', 'Technology', 'Sunnyvale'),
         (4, 'Oscorp', 'Biotechnology', 'New York')`
    );

    // Log in as the user
    await agent
      .post('/login')
      .send({ email: 'user@test.com', password: 'password' });
  });

  afterEach(async () => {
    await connection.rollback();
    if (global.__TEST_DB_CONNECTION__ === connection) {
      global.__TEST_DB_CONNECTION__ = null;
    }
    releaseConnection(connection);
  });

  afterAll(async () => {
    if (agent && agent.server && agent.server.close) {
      await new Promise(resolve => agent.server.close(resolve));
    }
  });

  it('should return 401 for an unauthenticated user', async () => {
    const unauthenticatedAgent = request.agent(app);
    const res = await unauthenticatedAgent.get('/api/employers/search?q=stark');
    expect(res.statusCode).toEqual(401);
  });

  it('should return matching employers for a valid search query', async () => {
    const res = await agent.get('/api/employers/search?q=corp');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(1);
    expect(res.body[0].nom).toBe('Oscorp');
  });

  it('should be case-insensitive', async () => {
    const res = await agent.get('/api/employers/search?q=STARK');
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].nom).toBe('Stark Industries');
  });

  it('should return multiple results if they match', async () => {
    const res = await agent.get('/api/employers/search?q=tech');
    expect(res.statusCode).toEqual(200);
    // All three have 'Technology' as sector, but we search in name. Let's adjust the test logic.
    // The query should search in the name. Let's search for 'corp' or 'industries' or 'enterprises'
    const res2 = await agent.get('/api/employers/search?q=e');
    expect(res2.statusCode).toEqual(200);
    expect(res2.body.length).toBe(3); // Wayne Enterprises, Cyberdyne Systems, Stark Industries
  });

  it('should return an empty array for a query with no matches', async () => {
    const res = await agent.get('/api/employers/search?q=nonexistent');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual([]);
  });

  it('should return all employers if query is empty or very short', async () => {
    const res = await agent.get('/api/employers/search?q=');
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBe(4);
  });
});
