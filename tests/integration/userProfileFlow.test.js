const request = require('supertest');
const initApp = require('../../server');
const { getConnection, releaseConnection } = require('../../src/config/database');
const bcrypt = require('bcryptjs');
const User = require('../../src/models/User');
const i18n = require('i18n');
const path = require('path');

describe('End-to-End User Profile Management Flow', () => {
  let connection;
  let agent;
  let userEmail;
  let userPassword;
  let userId;
  let app;
  let server;

  beforeAll(async () => {
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

    server = app.listen();
    agent = request.agent(server);

    // Create and log in a user once for the entire suite
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

    await agent.post('/login').send({ email: userEmail, password: userPassword });
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

  test('should handle errors when fetching profile', async () => {
    const findByIdSpy = jest.spyOn(User, 'findById').mockRejectedValue(new Error('Database error'));

    const res = await agent.get('/profile');

    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Erreur lors du chargement du profil');

    findByIdSpy.mockRestore();
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

  // New tests for validation and security

  test('should show validation errors when updating profile with invalid data', async () => {
    const res = await agent.post('/profile/edit').send({
      prenom: 'a', // Too short
      nom: 'b', // Too short
      email: 'not-an-email', // Invalid email for admin
      linkedin: 'not-a-url',
      annee_diplome: 'not-a-year',
      section_id: 1,
    });

    expect(res.statusCode).toEqual(200); // Re-renders the form with errors
    expect(res.text).toContain('Veuillez corriger les erreurs suivantes :');
    expect(res.text).toContain('Prénom requis');
    expect(res.text).toContain('Nom requis');
    expect(res.text).toContain('URL LinkedIn invalide');
  });

  test('should not allow a non-admin user to update admin-only fields', async () => {
    const originalEmail = userEmail;
    const originalYear = 2020;

    const res = await agent.post('/profile/edit').send({
      prenom: 'Normal',
      nom: 'User',
      // Attempt to change admin-only fields
      email: 'new.email@example.com',
      annee_diplome: 2022,
      section_id: 2,
    });

    expect(res.statusCode).toEqual(302);
    expect(res.headers.location).toEqual('/profile?success=1');

    const [user] = await connection.query('SELECT * FROM users WHERE id = ?', [userId]);
    expect(user[0].email).toBe(originalEmail); // Should NOT have changed
    expect(user[0].annee_diplome).toBe(originalYear); // Should NOT have changed
  });

  test('should return error when adding an employment record with invalid data', async () => {
    const res = await agent.post('/profile/employment/add').send({
      employer_name: '', // Empty name
      poste: 'Test',
      date_debut: 'invalid-date',
    });

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toEqual('Données invalides');
  });

  test('should prevent a user from updating another user’s employment record', async () => {
    // Create another user and their employment record
    const anotherUserEmail = `another_${Date.now()}@example.com`;
    const hashedPassword = await bcrypt.hash('password', 10);
    const [anotherUserResult] = await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [anotherUserEmail, hashedPassword, 'Another', 'User', 2021, 1, true, true]
    );
    const anotherUserId = anotherUserResult.insertId;

    const [employerResult] = await connection.query('INSERT INTO employers (nom) VALUES (?)', ['Another Company']);
    const employerId = employerResult.insertId;

    const [employmentResult] = await connection.query(
      'INSERT INTO user_employment (user_id, employer_id, poste, date_debut) VALUES (?, ?, ?, ?)',
      [anotherUserId, employerId, 'Other Role', '2023-01-01']
    );
    const employmentId = employmentResult.insertId;

    // Logged-in user (agent) tries to update the other user's record
    const res = await agent.post(`/profile/employment/${employmentId}`).send({
      poste: 'Updated by wrong user',
      date_debut: '2023-01-01',
    });

    expect(res.statusCode).toEqual(403); // Forbidden
    expect(res.body.error).toEqual('Accès non autorisé');
  });

  test('should prevent a user from deleting another user’s employment record', async () => {
    // Create another user and their employment record
    const anotherUserEmail = `another_delete_${Date.now()}@example.com`;
    const hashedPassword = await bcrypt.hash('password', 10);
    const [anotherUserResult] = await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [anotherUserEmail, hashedPassword, 'AnotherDelete', 'User', 2021, 1, true, true]
    );
    const anotherUserId = anotherUserResult.insertId;

    const [employerResult] = await connection.query('INSERT INTO employers (nom) VALUES (?)', ['Delete Company']);
    const employerId = employerResult.insertId;

    const [employmentResult] = await connection.query(
      'INSERT INTO user_employment (user_id, employer_id, poste, date_debut) VALUES (?, ?, ?, ?)',
      [anotherUserId, employerId, 'Other Role to Delete', '2023-01-01']
    );
    const employmentId = employmentResult.insertId;

    // Logged-in user (agent) tries to delete the other user's record
    const res = await agent.post(`/profile/employment/${employmentId}/delete`);

    expect(res.statusCode).toEqual(403); // Forbidden
    expect(res.body.error).toEqual('Accès non autorisé');
  });

  describe('API /profile/api/employers/suggest', () => {
    beforeAll(async () => {
      const tempConnection = await getConnection();
      await tempConnection.query("INSERT INTO employers (nom, ville) VALUES ('Stark Industries', 'New York'), ('Wayne Enterprises', 'Gotham'), ('Cyberdyne Systems', 'Sunnyvale')");
      releaseConnection(tempConnection);
    });

    test('should return employer suggestions for a valid query', async () => {
      const res = await agent.get('/profile/api/employers/suggest?q=Stark');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(1);
      expect(res.body[0].nom).toBe('Stark Industries');
    });

    test('should return an empty array for a query with no matches', async () => {
      const res = await agent.get('/profile/api/employers/suggest?q=nonexistent');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual([]);
    });

    test('should return an empty array for a short query', async () => {
      const res = await agent.get('/profile/api/employers/suggest?q=a');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual([]);
    });
  });
});
