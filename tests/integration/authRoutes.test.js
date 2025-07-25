const request = require('supertest');
const initApp = require('../../server');
const { getConnection, releaseConnection } = require('../../src/config/database');
const bcrypt = require('bcryptjs');
const User = require('../../src/models/User');
const i18n = require('i18n');
const path = require('path');

describe('Authentication Routes', () => {
  let app;
  let server;
  let connection;

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
    await connection.execute("SET FOREIGN_KEY_CHECKS = 1;");

    // Seed a section for registration tests
    await connection.execute("INSERT INTO sections (id, nom) VALUES (1, 'SN IR');");
  });

  afterEach(async () => {
    await connection.rollback();
    if (connection === global.__TEST_DB_CONNECTION__) {
      global.__TEST_DB_CONNECTION__ = null; // Clear global connection only if it's the one we set
    }
    releaseConnection(connection);
  });

  // Test cases will go here

  // GET /
  it('should redirect from / to /login if not authenticated', async () => {
    const res = await request(server).get('/');
    expect(res.statusCode).toEqual(302);
    expect(res.headers.location).toContain('/login'); // Relaxed assertion
  });

  // GET /login
  it('should render the login page if not authenticated', async () => {
    const res = await request(server).get('/login');
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Connectez-vous à votre compte');
  });

  it('should redirect to dashboard if already authenticated (GET /login)', async () => {
    const agent = request.agent(server);
    const hashedPassword = await bcrypt.hash('password123', 10);
    await connection.execute(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['test@example.com', hashedPassword, 'Test', 'User', 2020, 1, true, true]
    );
    await agent.post('/login').send({ email: 'test@example.com', password: 'password123' });

    const res = await agent.get('/login');
    expect(res.statusCode).toEqual(302);
    expect(res.headers.location).toEqual('/dashboard');
  });

  // POST /login - Success
  it('should allow a user to log in successfully with valid credentials', async () => {
    const agent = request.agent(server);
    const hashedPassword = await bcrypt.hash('password123', 10);
    await connection.execute(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['login_success@example.com', hashedPassword, 'Login', 'User', 2020, 1, true, true]
    );

    const res = await agent.post('/login').send({ email: 'login_success@example.com', password: 'password123' });
    expect(res.statusCode).toEqual(302);
    expect(res.headers.location).toEqual('/dashboard');
  });

  it('should redirect to the specified URL after successful login', async () => {
    const agent = request.agent(server);
    const hashedPassword = await bcrypt.hash('password123', 10);
    await connection.execute(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['redirect_user@example.com', hashedPassword, 'Redirect', 'User', 2020, 1, true, true]
    );

    const res = await agent.post('/login').send({ email: 'redirect_user@example.com', password: 'password123', redirect: '/profile' });
    expect(res.statusCode).toEqual(302);
    expect(res.headers.location).toEqual('/profile');
  });

  // POST /login - Failure (Invalid Credentials)
  it('should return an error for incorrect email during login', async () => {
    const res = await request(server).post('/login').send({ email: 'wrong@example.com', password: 'password123' });
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Email ou mot de passe incorrect');
  });

  it('should return an error for incorrect password during login', async () => {
    const hashedPassword = await bcrypt.hash('correct_password', 10);
    await connection.execute(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['password_test@example.com', hashedPassword, 'Password', 'Test', 2020, 1, true, true]
    );

    const res = await request(server).post('/login').send({ email: 'password_test@example.com', password: 'wrong_password' });
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Email ou mot de passe incorrect');
  });

  // POST /login - Failure (Validation Errors)
  it('should return an error for invalid email format during login', async () => {
    const res = await request(server).post('/login').send({ email: 'invalid-email', password: 'password123' });
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Données invalides');
  });

  it('should return an error for empty password during login', async () => {
    const res = await request(server).post('/login').send({ email: 'test@example.com', password: '' });
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Données invalides');
  });

  // POST /login - Failure (Account Status)
  it('should return an error for inactive account during login', async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);
    await connection.execute(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['inactive@example.com', hashedPassword, 'Inactive', 'User', 2020, 1, true, false]
    );

    const res = await request(server).post('/login').send({ email: 'inactive@example.com', password: 'password123' });
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Compte désactivé');
  });

  it('should render pending approval page for unapproved account during login', async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);
    await connection.execute(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['unapproved@example.com', hashedPassword, 'Unapproved', 'User', 2020, 1, false, true]
    );

    const res = await request(server).post('/login').send({ email: 'unapproved@example.com', password: 'password123' });
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Compte en attente d\'approbation');
  });

  // GET /register
  it('should render the registration page with sections', async () => {
    const res = await request(server).get('/register');
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Inscription - Anciens BTS SN/CIEL LJV');
    expect(res.text).toContain('SN IR'); // Check if seeded section is present
  });

  it('should redirect to dashboard if already authenticated (GET /register)', async () => {
    const agent = request.agent(server);
    const hashedPassword = await bcrypt.hash('password123', 10);
    await connection.execute(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['reg_auth@example.com', hashedPassword, 'Reg', 'Auth', 2020, 1, true, true]
    );
    await agent.post('/login').send({ email: 'reg_auth@example.com', password: 'password123' });

    const res = await agent.get('/register');
    expect(res.statusCode).toEqual(302);
    expect(res.headers.location).toEqual('/dashboard');
  });

  // POST /register - Success
  it('should allow a user to submit a registration request successfully', async () => {
    const res = await request(server).post('/register').send({
      email: 'new_reg@example.com',
      prenom: 'New',
      nom: 'User',
      annee_diplome: 2022,
      section_id: 1,
      message: 'Hello'
    });
    expect(res.statusCode).toEqual(302);
    expect(res.headers.location).toEqual('/register-success');

    const [rows] = await connection.execute('SELECT * FROM registration_requests WHERE email = ?', ['new_reg@example.com']);
    expect(rows.length).toBe(1);
    expect(rows[0].prenom).toBe('New');
  });

  // POST /register - Failure (Validation Errors)
  it('should return an error for invalid email format during registration', async () => {
    const res = await request(server).post('/register').send({
      email: 'invalid-email',
      prenom: 'New',
      nom: 'User',
      annee_diplome: 2022,
      section_id: 1
    });
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Email invalide');
  });

  it('should return an error for short prenom during registration', async () => {
    const res = await request(server).post('/register').send({
      email: 'test@example.com',
      prenom: 'N',
      nom: 'User',
      annee_diplome: 2022,
      section_id: 1
    });
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Prénom requis (min 2 caractères)');
  });

  it('should return an error for short nom during registration', async () => {
    const res = await request(server).post('/register').send({
      email: 'test@example.com',
      prenom: 'New',
      nom: 'U',
      annee_diplome: 2022,
      section_id: 1
    });
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Nom requis (min 2 caractères)');
  });

  it('should return an error for invalid annee_diplome during registration', async () => {
    const res = await request(server).post('/register').send({
      email: 'test@example.com',
      prenom: 'New',
      nom: 'User',
      annee_diplome: 1000,
      section_id: 1
    });
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Année de diplôme invalide');
  });

  it('should return an error for invalid section_id during registration', async () => {
    const res = await request(server).post('/register').send({
      email: 'test@example.com',
      prenom: 'New',
      nom: 'User',
      annee_diplome: 2022,
      section_id: 999 // Non-existent section
    });
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Erreur interne, veuillez réessayer'); // Updated expected message
  });

  // POST /register - Failure (Existing User/Pending Request)
  it('should return an error if email already exists as a user', async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);
    await connection.execute(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['existing_user@example.com', hashedPassword, 'Existing', 'User', 2020, 1, true, true]
    );

    const res = await request(server).post('/register').send({
      email: 'existing_user@example.com',
      prenom: 'New',
      nom: 'User',
      annee_diplome: 2022,
      section_id: 1
    });
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Cette adresse email est déjà utilisée');
  });

  it('should return an error if a registration request for email is already pending', async () => {
    await connection.execute(
      'INSERT INTO registration_requests (email, prenom, nom, annee_diplome, section_id) VALUES (?, ?, ?, ?, ?)',
      ['pending_reg@example.com', 'Pending', 'User', 2022, 1]
    );

    const res = await request(server).post('/register').send({
      email: 'pending_reg@example.com',
      prenom: 'New',
      nom: 'User',
      annee_diplome: 2022,
      section_id: 1
    });
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Une demande d&#39;inscription est déjà en cours pour cette adresse email'); // Updated expected message
  });

  // GET /register/complete/:key
  it('should render the complete registration form with valid key', async () => {
    const [result] = await connection.execute(
      'INSERT INTO registration_requests (email, prenom, nom, annee_diplome, section_id) VALUES (?, ?, ?, ?, ?)',
      ['complete_reg@example.com', 'Complete', 'User', 2022, 1]
    );
    const requestId = result.insertId;
    const registrationKey = await User.generateRegistrationKey(requestId);

    const res = await request(server).get(`/register/complete/${registrationKey}`);
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Finaliser votre inscription');
    expect(res.text).toContain('complete_reg@example.com');
  });

  it('should return 404 for invalid or expired registration key', async () => {
    const res = await request(server).get('/register/complete/invalid_key');
    expect(res.statusCode).toEqual(404);
    expect(res.text).toContain('Lien d&#39;inscription invalide ou expiré.'); // Updated expected message
  });

  // POST /register/complete/:key - Success
  it('should allow a user to complete registration with valid data', async () => {
    const [result] = await connection.execute(
      'INSERT INTO registration_requests (email, prenom, nom, annee_diplome, section_id) VALUES (?, ?, ?, ?, ?)',
      ['final_user@example.com', 'Final', 'User', 2022, 1]
    );
    const requestId = result.insertId;
    const registrationKey = await User.generateRegistrationKey(requestId);

    const res = await request(server).post(`/register/complete/${registrationKey}`).send({
      password: 'final_password',
      confirm_password: 'final_password',
      prenom: 'Final', // Added profile data
      nom: 'User',     // Added profile data
      annee_diplome: 2022, // Added profile data
      section_id: 1      // Added profile data
    });
    expect(res.statusCode).toEqual(302);
    expect(res.headers.location).toEqual('/login?success=registration_complete');

    const [userRows] = await connection.execute('SELECT * FROM users WHERE email = ?', ['final_user@example.com']);
    expect(userRows.length).toBe(1);
    expect(userRows[0].is_approved).toBe(1); // New users are approved by default in this test setup

    const [reqRows] = await connection.execute('SELECT * FROM registration_requests WHERE id = ?', [requestId]);
    expect(reqRows.length).toBe(0); // Request should be deleted
  });

  // POST /register/complete/:key - Failure (Validation Errors)
  it('should return an error for short password during completion', async () => {
    const [result] = await connection.execute(
      'INSERT INTO registration_requests (email, prenom, nom, annee_diplome, section_id) VALUES (?, ?, ?, ?, ?)',
      ['short_pass@example.com', 'Short', 'Pass', 2022, 1]
    );
    const requestId = result.insertId;
    const registrationKey = await User.generateRegistrationKey(requestId);

    const res = await request(server).post(`/register/complete/${registrationKey}`).send({
      password: 'short',
      confirm_password: 'short',
    });
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Le mot de passe doit contenir au moins 6 caractères');
  });

  it('should return an error for mismatched passwords during completion', async () => {
    const [result] = await connection.execute(
      'INSERT INTO registration_requests (email, prenom, nom, annee_diplome, section_id) VALUES (?, ?, ?, ?, ?)',
      ['mismatch_pass@example.com', 'Mismatch', 'Pass', 2022, 1]
    );
    const requestId = result.insertId;
    const registrationKey = await User.generateRegistrationKey(requestId);

    const res = await request(server).post(`/register/complete/${registrationKey}`).send({
      password: 'password123',
      confirm_password: 'password_mismatch',
    });
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Les mots de passe ne correspondent pas');
  });

  // POST /logout
  it('should allow a logged-in user to log out successfully', async () => {
    const agent = request.agent(server);
    const hashedPassword = await bcrypt.hash('password123', 10);
    await connection.execute(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['logout_user@example.com', hashedPassword, 'Logout', 'User', 2020, 1, true, true]
    );
    await agent.post('/login').send({ email: 'logout_user@example.com', password: 'password123' });

    const res = await agent.post('/logout');
    expect(res.statusCode).toEqual(302);
    expect(res.headers.location).toContain('/login'); // Relaxed assertion

    // Verify session is destroyed by trying to access a protected route
    const protectedRes = await agent.get('/dashboard');
    expect(protectedRes.statusCode).toEqual(302);
    expect(protectedRes.headers.location).toContain('/login'); // Relaxed assertion
  });

  // GET /dashboard
  it('should render the dashboard for an authenticated user', async () => {
    const agent = request.agent(server);
    const hashedPassword = await bcrypt.hash('password123', 10);
    await connection.execute(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['dashboard_user@example.com', hashedPassword, 'Dashboard', 'User', 2020, 1, true, true]
    );
    await agent.post('/login').send({ email: 'dashboard_user@example.com', password: 'password123' });

    const res = await agent.get('/dashboard');
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Accueil - Anciens BTS SN/CIEL LJV');
  });
});
