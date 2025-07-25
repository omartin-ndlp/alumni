const request = require('supertest');
const initApp = require('../../server');
const { getConnection, releaseConnection } = require('../../src/config/database');
const bcrypt = require('bcryptjs');
const User = require('../../src/models/User');

describe('End-to-End User Profile Management Flow', () => {
  let connection;
  let agent;
  let userEmail;
  let userPassword;
  let userId;
  let app;
  let server;

  beforeAll((done) => {
    app = initApp();
    server = app.listen(done);

    (async () => {
      userEmail = `profile_${Date.now()}@example.com`;
      userPassword = 'password123';
      const hashedPassword = await bcrypt.hash(userPassword, 10);

      const tempConnection = await getConnection();
      const [userResult] = await tempConnection.query(
        'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userEmail, hashedPassword, 'Profile', 'User', 2020, 1, true, true]
      );
      userId = userResult.insertId;
      releaseConnection(tempConnection);

      agent = request.agent(server);
      await agent.post('/login').send({ email: userEmail, password: userPassword });
      done();
    })();
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(async () => {
    connection = await getConnection();
    await connection.beginTransaction();
    global.__TEST_DB_CONNECTION__ = connection;
  });

  afterEach(async () => {
    await connection.rollback();
    if (connection === global.__TEST_DB_CONNECTION__) {
      global.__TEST_DB_CONNECTION__ = null; // Clear global connection only if it's the one we set
    }
    releaseConnection(connection);
  });

  test('should allow a logged-in user to view their own profile', async () => {
    const res = await agent.get('/profile');

    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Profile User'); // Check for user's name in the rendered page
    expect(res.text).toContain(userEmail);
  });

  test('should allow a logged-in user to update their personal profile information', async () => {
    const updatedPrenom = 'UpdatedProfile';
    const updatedNom = 'UpdatedUser';
    const updatedAnneeDiplome = 2019;

    const res = await agent.post('/profile/edit').send({
      prenom: updatedPrenom,
      nom: updatedNom,
      annee_diplome: updatedAnneeDiplome,
      section_id: 1, // Assuming section_id 1 exists and is valid
    });

    expect(res.statusCode).toEqual(302); // Expect redirect on success
    expect(res.headers.location).toEqual('/profile?success=1');

    // Verify user data in the database
    const [rows] = await connection.query('SELECT * FROM users WHERE id = ?', [userId]);
    expect(rows.length).toBe(1);
    expect(rows[0].prenom).toBe(updatedPrenom);
    expect(rows[0].nom).toBe(updatedNom);
  });

  test('should allow a logged-in user to add a new employment record', async () => {
    const employerName = `New Company ${Date.now()}`;
    const poste = 'New Role';
    const date_debut = '2023-01-01';
    const is_current = true;

    const res = await agent.post('/profile/employment/add').send({
      employer_name: employerName,
      poste: poste,
      date_debut: date_debut,
      is_current: is_current,
    });

    expect(res.statusCode).toEqual(302); // Expect redirect on success
    expect(res.headers.location).toEqual('/profile/employment');

    // Verify employment record in the database
    const [employmentRows] = await connection.query(
      'SELECT ue.*, e.nom as employer_name FROM user_employment ue JOIN employers e ON ue.employer_id = e.id WHERE ue.user_id = ? AND ue.poste = ?',
      [userId, poste]
    );
    expect(employmentRows.length).toBe(1);
    expect(employmentRows[0].employer_name).toBe(employerName);
    expect(employmentRows[0].poste).toBe(poste);
    expect(employmentRows[0].date_debut).toEqual(new Date(date_debut));
    expect(employmentRows[0].is_current).toBe(is_current ? 1 : 0);
  });

  test('should allow a logged-in user to update an existing employment record', async () => {
    // Setup: Add an initial employment record
    const initialEmployerName = `Initial Company ${Date.now()}`;
    const initialPoste = 'Initial Role';
    const initialDateDebut = '2022-01-01';
    const initialIsCurrent = true;

    const [employerResult] = await connection.query('INSERT INTO employers (nom) VALUES (?)', [initialEmployerName]);
    const employerId = employerResult.insertId;

    const [employmentResult] = await connection.query(
      'INSERT INTO user_employment (user_id, employer_id, poste, date_debut, is_current) VALUES (?, ?, ?, ?, ?)',
      [userId, employerId, initialPoste, initialDateDebut, initialIsCurrent]
    );
    const employmentId = employmentResult.insertId;

    // Action: Update the employment record
    const updatedPoste = 'Updated Role';
    const updatedIsCurrent = false;
    const updatedDateFin = '2023-12-31';
    const date_debut = initialDateDebut; // Define date_debut here

    const res = await agent.post(`/profile/employment/${employmentId}`).send({
      poste: updatedPoste,
      date_debut: date_debut, // Ensure date_debut is passed
      date_fin: updatedDateFin,
      is_current: updatedIsCurrent,
    });

    expect(res.statusCode).toEqual(302); // Expect redirect on success
    expect(res.headers.location).toEqual('/profile/employment');

    // Verify updated employment record in the database
    const [updatedEmploymentRows] = await connection.query('SELECT * FROM user_employment WHERE id = ?', [employmentId]);
    expect(updatedEmploymentRows.length).toBe(1);
    expect(updatedEmploymentRows[0].poste).toBe(updatedPoste);
    expect(updatedEmploymentRows[0].date_fin).toEqual(new Date(updatedDateFin));
    expect(updatedEmploymentRows[0].is_current).toBe(updatedIsCurrent ? 1 : 0);
  });

  test('should allow a logged-in user to delete an employment record', async () => {
    // Setup: Add an initial employment record
    const employerName = `Delete Company ${Date.now()}`;
    const poste = 'Role to Delete';
    const date_debut = '2022-01-01';

    const [employerResult] = await connection.query('INSERT INTO employers (nom) VALUES (?)', [employerName]);
    const employerId = employerResult.insertId;

    const [employmentResult] = await connection.query(
      'INSERT INTO user_employment (user_id, employer_id, poste, date_debut, is_current) VALUES (?, ?, ?, ?, ?)',
      [userId, employerId, poste, date_debut, true]
    );
    const employmentId = employmentResult.insertId;

    // Verify it exists before deletion
    let [employmentRecords] = await connection.query('SELECT * FROM user_employment WHERE id = ?', [employmentId]);
    expect(employmentRecords.length).toBe(1);

    // Action: Delete the employment record
    const res = await agent.post(`/profile/employment/${employmentId}/delete`);

    expect(res.statusCode).toEqual(302); // Expect redirect on success
    expect(res.headers.location).toEqual('/profile/employment');

    // Verify employment record is deleted from the database
    [employmentRecords] = await connection.query('SELECT * FROM user_employment WHERE id = ?', [employmentId]);
    expect(employmentRecords.length).toBe(0);
  });

  afterAll(async () => {
    // Close the server if it was started by supertest
    if (agent && agent.server && agent.server.close) {
      await new Promise(resolve => agent.server.close(resolve));
    }
  });
});
