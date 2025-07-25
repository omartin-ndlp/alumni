const request = require('supertest');
const initApp = require('../../server');
const { getConnection, releaseConnection } = require('../../src/config/database');
const bcrypt = require('bcryptjs');
const i18n = require('i18n');
const path = require('path');

describe('Admin Data Manipulation Routes', () => {
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

  describe('User Status Toggling', () => {
    let testUserId;

    beforeEach(async () => {
      // Create a user for testing status toggle
      const hashedPassword = await bcrypt.hash('togglepass', 10);
      const [result] = await connection.execute(
        'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['toggle@test.com', hashedPassword, 'Toggle', 'User', 2022, 1, true, true, false]
      );
      testUserId = result.insertId;
    });

    it('should allow an admin to deactivate an active user', async () => {
      const res = await adminAgent.post(`/admin/users/${testUserId}/toggle-status`);
      expect(res.statusCode).toEqual(302);
      expect(res.headers.location).toEqual('/admin/users?success=status_updated');

      const [user] = await connection.execute('SELECT is_active FROM users WHERE id = ?', [testUserId]);
      expect(user[0].is_active).toBe(0); // 0 for false
    });

    it('should allow an admin to activate an inactive user', async () => {
      // First, deactivate the user
      await connection.execute('UPDATE users SET is_active = FALSE WHERE id = ?', [testUserId]);

      const res = await adminAgent.post(`/admin/users/${testUserId}/toggle-status`);
      expect(res.statusCode).toEqual(302);
      expect(res.headers.location).toEqual('/admin/users?success=status_updated');

      const [user] = await connection.execute('SELECT is_active FROM users WHERE id = ?', [testUserId]);
      expect(user[0].is_active).toBe(1); // 1 for true
    });

    it('should return 404 if toggling status for a non-existent user', async () => {
      const res = await adminAgent.post('/admin/users/9999/toggle-status');
      expect(res.statusCode).toEqual(404);
      expect(res.body.error).toEqual('Utilisateur non trouvé');
    });
  });

  describe('Section Management', () => {
    it('should allow an admin to add a new section', async () => {
      const res = await adminAgent.post('/admin/sections/add').send({
        nom: 'New Section',
        description: 'Description of new section',
      });
      expect(res.statusCode).toEqual(302);
      expect(res.headers.location).toEqual('/admin/sections?success=added');

      const [sections] = await connection.execute('SELECT * FROM sections WHERE nom = ?', ['New Section']);
      expect(sections.length).toBe(1);
    });

    it('should return an error if adding a duplicate section name', async () => {
      await connection.execute('INSERT INTO sections (nom) VALUES (?)', ['Duplicate Section']);

      const res = await adminAgent.post('/admin/sections/add').send({
        nom: 'Duplicate Section',
      });
      expect(res.statusCode).toEqual(302);
      expect(res.headers.location).toEqual('/admin/sections?error=duplicate');
    });

    it('should return an error for invalid input when adding a section', async () => {
      const res = await adminAgent.post('/admin/sections/add').send({
        nom: 'N', // Too short
      });
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toEqual('Données invalides');
    });

    it('should allow an admin to edit an existing section', async () => {
      const [result] = await connection.execute('INSERT INTO sections (nom) VALUES (?)', ['Section to Edit']);
      const sectionId = result.insertId;

      const res = await adminAgent.post(`/admin/sections/${sectionId}/edit`).send({
        nom: 'Edited Section',
        description: 'Updated description',
      });
      expect(res.statusCode).toEqual(302);
      expect(res.headers.location).toEqual('/admin/sections?success=updated');

      const [sections] = await connection.execute('SELECT * FROM sections WHERE id = ?', [sectionId]);
      expect(sections[0].nom).toEqual('Edited Section');
      expect(sections[0].description).toEqual('Updated description');
    });

    it('should return an error for invalid input when editing a section', async () => {
      const [result] = await connection.execute('INSERT INTO sections (nom) VALUES (?)', ['Section to Edit Invalid']);
      const sectionId = result.insertId;

      const res = await adminAgent.post(`/admin/sections/${sectionId}/edit`).send({
        nom: 'S', // Too short
      });
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toEqual('Données invalides');
    });

    it('should allow an admin to delete a section if it is not in use', async () => {
      const [result] = await connection.execute('INSERT INTO sections (nom) VALUES (?)', ['Section to Delete']);
      const sectionId = result.insertId;

      const res = await adminAgent.post(`/admin/sections/${sectionId}/delete`);
      expect(res.statusCode).toEqual(302);
      expect(res.headers.location).toEqual('/admin/sections?success=deleted');

      const [sections] = await connection.execute('SELECT * FROM sections WHERE id = ?', [sectionId]);
      expect(sections.length).toBe(0);
    });

    it('should prevent an admin from deleting a section if it is associated with users', async () => {
      const [result] = await connection.execute('INSERT INTO sections (nom) VALUES (?)', ['Section In Use']);
      const sectionId = result.insertId;

      // Associate a user with this section
      const hashedPassword = await bcrypt.hash('userpass', 10);
      await connection.execute(
        'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['user_in_section@test.com', hashedPassword, 'User', 'Section', 2020, sectionId, true, true, false]
      );

      const res = await adminAgent.post(`/admin/sections/${sectionId}/delete`);
      expect(res.statusCode).toEqual(302);
      expect(res.headers.location).toEqual('/admin/sections?error=section_in_use');

      const [sections] = await connection.execute('SELECT * FROM sections WHERE id = ?', [sectionId]);
      expect(sections.length).toBe(1); // Should not be deleted
    });
  });

  describe('Employer Export', () => {
    beforeEach(async () => {
      // Seed data for employer export tests
      await connection.execute("INSERT INTO employers (id, nom, ville, secteur) VALUES (1, 'Renault Trucks', 'Lyon', 'Automobile'), (2, 'Chez Renault Cafe', 'Paris', 'Restauration'), (3, 'Google', 'Paris', 'Tech');");
      await connection.execute("INSERT INTO user_employment (user_id, employer_id, poste) VALUES (?, 1, 'Développeur'), (?, 2, 'Barista'), (?, 3, 'Ingénieur');", [adminUser.id, regularUser.id, regularUser.id]);
    });

    it('should render the export page with cities and sections', async () => {
      const res = await adminAgent.get('/admin/export/employers');
      expect(res.statusCode).toEqual(200);
      expect(res.text).toContain('Lyon');
      expect(res.text).toContain('Paris');
      expect(res.text).toContain('SN IR');
      expect(res.text).toContain('CIEL IR');
    });

    it('should export employers as CSV', async () => {
      const res = await adminAgent
        .post('/admin/export/employers')
        .send({
          fields: ['nom', 'ville'],
          villes: ['Paris'],
          sections: ['2'],
          sort: 'nom',
          format: 'csv'
        });
      
      expect(res.statusCode).toEqual(200);
      expect(res.header['content-type']).toEqual('text/csv; charset=utf-8');
      expect(res.text).toContain('nom,ville');
      expect(res.text).toContain('"Chez Renault Cafe","Paris"');
      expect(res.text).toContain('"Google","Paris"');
      expect(res.text).not.toContain('Renault Trucks');
    });

    it('should export employers as plain text', async () => {
      const res = await adminAgent
        .post('/admin/export/employers')
        .send({
          fields: ['nom', 'ville'],
          nom: 'renault',
          sort: 'ville',
          format: 'txt'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.header['content-type']).toEqual('text/plain; charset=utf-8');
      expect(res.text).toContain('nom: Renault Trucks | ville: Lyon');
      expect(res.text).toContain('nom: Chez Renault Cafe | ville: Paris');
    });

    it('should return an empty result when no employers match', async () => {
      const res = await adminAgent
        .post('/admin/export/employers')
        .send({
          fields: ['nom'],
          villes: ['Lyon'],
          sections: ['2'], // User in Lyon is in section 1
          format: 'csv'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.text).toEqual('nom\n');
    });
  });
});