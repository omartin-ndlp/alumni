const request = require('supertest');
const app = require('../../server');
const { getConnection, releaseConnection } = require('../../src/config/database');
const bcrypt = require('bcryptjs');

describe('Admin Section Management', () => {
  let connection;
  let adminAgent; // supertest agent for maintaining admin session
  let adminEmail;
  let adminPassword;
  let adminId;

  beforeEach(async () => {
    connection = await getConnection();
    await connection.beginTransaction();
    global.__TEST_DB_CONNECTION__ = connection; // For transactional isolation

    // Create and log in an admin user for each test
    adminEmail = `admin_${Date.now()}@example.com`;
    adminPassword = 'adminpassword';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const [adminResult] = await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_admin, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [adminEmail, hashedPassword, 'Admin', 'User', 2010, 1, true, true, true]
    );
    adminId = adminResult.insertId;

    adminAgent = request.agent(app);
    await adminAgent.post('/login').send({ email: adminEmail, password: adminPassword });
  });

  afterEach(async () => {
    await connection.rollback();
    if (connection === global.__TEST_DB_CONNECTION__) {
      global.__TEST_DB_CONNECTION__ = null; // Clear global connection only if it's the one we set
    }
    releaseConnection(connection);
  });

  afterAll(async () => {
    // Close the server if it was started by supertest
    if (adminAgent && adminAgent.server && adminAgent.server.close) {
      await new Promise(resolve => adminAgent.server.close(resolve));
    }
  });

  describe('GET /admin/sections', () => {
    it('should display the sections management page for an authenticated admin', async () => {
      const res = await adminAgent.get('/admin/sections');
      expect(res.statusCode).toEqual(200);
      expect(res.text).toContain('Gestion des sections');
      expect(res.text).toContain('Ajouter une nouvelle section');
      expect(res.text).toContain('Sections existantes');
    });

    it('should redirect non-admin users to login', async () => {
      const regularUserAgent = request.agent(app);
      await regularUserAgent.post('/login').send({ email: 'user@test.com', password: 'password' });
      const res = await regularUserAgent.get('/admin/sections');
      expect(res.statusCode).toEqual(302);
      expect(res.headers.location).toContain('/login');
    });
  });

  describe('POST /admin/sections/add', () => {
    it('should allow an admin to add a new section', async () => {
      const newSectionName = `Test Section ${Date.now()}`;
      const newSectionDescription = 'Description for test section';
      const res = await adminAgent.post('/admin/sections/add').send({
        nom: newSectionName,
        description: newSectionDescription,
      });

      expect(res.statusCode).toEqual(302); // Expect redirect
      expect(res.headers.location).toContain('/admin/sections?success=added');

      // Verify section is added in the database
      const [addedSection] = await connection.query('SELECT * FROM sections WHERE nom = ?', [newSectionName]);
      expect(addedSection.length).toBe(1);
      expect(addedSection[0].nom).toBe(newSectionName);
      expect(addedSection[0].description).toBe(newSectionDescription);
    });

    it('should return an error if adding a duplicate section name', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const existingSectionName = 'Existing Section';
      await connection.query('INSERT INTO sections (nom) VALUES (?)', [existingSectionName]);

      const res = await adminAgent.post('/admin/sections/add').send({
        nom: existingSectionName,
        description: 'Some description',
      });

      expect(res.statusCode).toEqual(302); // Expect redirect
      expect(res.headers.location).toContain('/admin/sections?error=duplicate');
      consoleErrorSpy.mockRestore();
    });

    it('should return an error for invalid input when adding a section', async () => {
      const res = await adminAgent.post('/admin/sections/add').send({
        nom: '', // Invalid name
      });

      expect(res.statusCode).toEqual(400); // Expect bad request due to validation
    });
  });

  describe('POST /admin/sections/:id/edit', () => {
    let sectionId;
    let originalSectionName;

    beforeEach(async () => {
      originalSectionName = `Original Section ${Date.now()}`;
      const [result] = await connection.query('INSERT INTO sections (nom) VALUES (?)', [originalSectionName]);
      sectionId = result.insertId;
    });

    it('should allow an admin to edit an existing section', async () => {
      const updatedSectionName = `Updated Section ${Date.now()}`;
      const updatedSectionDescription = 'Updated description';
      const res = await adminAgent.post(`/admin/sections/${sectionId}/edit`).send({
        nom: updatedSectionName,
        description: updatedSectionDescription,
      });

      expect(res.statusCode).toEqual(302); // Expect redirect
      expect(res.headers.location).toContain('/admin/sections?success=updated');

      // Verify section is updated in the database
      const [updatedSection] = await connection.query('SELECT * FROM sections WHERE id = ?', [sectionId]);
      expect(updatedSection.length).toBe(1);
      expect(updatedSection[0].nom).toBe(updatedSectionName);
      expect(updatedSection[0].description).toBe(updatedSectionDescription);
    });

    it('should return an error for invalid input when editing a section', async () => {
      const res = await adminAgent.post(`/admin/sections/${sectionId}/edit`).send({
        nom: '', // Invalid name
      });

      expect(res.statusCode).toEqual(400); // Expect bad request due to validation
    });
  });

  describe('POST /admin/sections/:id/delete', () => {
    let sectionIdToDelete;

    beforeEach(async () => {
      const [result] = await connection.query('INSERT INTO sections (nom) VALUES (?)', [`Delete Section ${Date.now()}`]);
      sectionIdToDelete = result.insertId;
    });

    it('should allow an admin to delete a section if it is not in use', async () => {
      const res = await adminAgent.post(`/admin/sections/${sectionIdToDelete}/delete`);

      expect(res.statusCode).toEqual(302); // Expect redirect
      expect(res.headers.location).toContain('/admin/sections?success=deleted');

      // Verify section is deleted from the database
      const [deletedSection] = await connection.query('SELECT * FROM sections WHERE id = ?', [sectionIdToDelete]);
      expect(deletedSection.length).toBe(0);
    });

    it('should prevent an admin from deleting a section if it is associated with users', async () => {
      // Create a user associated with the section
      const hashedPassword = await bcrypt.hash('password', 10);
      await connection.query(
        'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_admin, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [`user_in_section_${Date.now()}@test.com`, hashedPassword, 'User', 'In Section', 2020, sectionIdToDelete, false, true, true]
      );

      const res = await adminAgent.post(`/admin/sections/${sectionIdToDelete}/delete`);

      expect(res.statusCode).toEqual(302); // Expect redirect
      expect(res.headers.location).toContain('/admin/sections?error=section_in_use');

      // Verify section is NOT deleted from the database
      const [sectionAfterAttempt] = await connection.query('SELECT * FROM sections WHERE id = ?', [sectionIdToDelete]);
      expect(sectionAfterAttempt.length).toBe(1);
    });
  });
});
