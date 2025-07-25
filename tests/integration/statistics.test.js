const request = require('supertest');
const express = require('express');
const session = require('express-session');
const adminRoutes = require('../../src/routes/admin');
const { getConnection, releaseConnection } = require('../../src/config/database');
const i18n = require('i18n');
const path = require('path');

describe('Admin Statistics Page', () => {
  let app;
  let db;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: true,
    }));

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

    // Mock authentication middleware
    app.use((req, res, next) => {
      req.user = { id: 1, is_admin: true, is_approved: true, is_active: true };
      req.session.user = { id: 1, is_admin: true, is_approved: true, is_active: true };
      next();
    });

    app.set('view engine', 'ejs');
    app.set('views', './src/views');
    app.use('/admin', adminRoutes);
  });

  beforeEach(async () => {
    db = await global.__TEST_DB_POOL__.getConnection();
    await db.beginTransaction();
    // Clean up tables before seeding
    await db.execute("SET FOREIGN_KEY_CHECKS = 0;");
    await db.execute("TRUNCATE TABLE user_employment;");
    await db.execute("TRUNCATE TABLE employers;");
    await db.execute("TRUNCATE TABLE users;");
    await db.execute("TRUNCATE TABLE sections;");
    await db.execute("TRUNCATE TABLE registration_requests;");
    await db.execute("SET FOREIGN_KEY_CHECKS = 1;");

    // Seed data
    await db.execute("INSERT INTO sections (id, nom) VALUES (1, 'SN IR'), (2, 'CIEL IR');");
    await db.execute("INSERT INTO users (id, nom, prenom, email, password_hash, section_id, annee_diplome, is_admin, is_approved, is_active) VALUES (1, 'Admin', 'User', 'admin@test.com', 'password', 1, 2020, TRUE, TRUE, TRUE), (2, 'Test', 'User', 'test@test.com', 'password', 2, 2021, FALSE, TRUE, TRUE), (3, 'Pending', 'User', 'pending@test.com', 'password', 1, 2022, FALSE, FALSE, TRUE);");
    await db.execute("INSERT INTO registration_requests (id, email, prenom, nom, annee_diplome, section_id) VALUES (1, 'req@test.com', 'Req', 'User', 2023, 1);");
    await db.execute("INSERT INTO employers (id, nom, ville, secteur) VALUES (1, 'Employer A', 'Paris', 'IT'), (2, 'Employer B', 'Lyon', 'Finance');");
    await db.execute("INSERT INTO user_employment (user_id, employer_id, poste, date_debut, is_current) VALUES (1, 1, 'Dev', '2020-01-01', TRUE), (2, 2, 'Analyst', '2021-03-15', TRUE);");
  });

  afterEach(async () => {
    await db.rollback();
    db.release();
  });

  it('should render the statistics page successfully', async () => {
    const res = await request(app).get('/admin/statistics');
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Statistiques Administrateur');
    expect(res.text).toMatch(/Total Utilisateurs:\s*<\/strong>\s*2<\/p>/);
    expect(res.text).toMatch(/Demandes en attente:\s*<\/strong>\s*1<\/p>/);
    expect(res.text).toMatch(/Total Employeurs:\s*<\/strong>\s*2<\/p>/);
    expect(res.text).toMatch(/Emplois Actuels:\s*<\/strong>\s*2<\/p>/);
    expect(res.text).toMatch(/Année 2020\s*<span class="badge bg-primary rounded-pill">1<\/span>/);
    expect(res.text).toMatch(/Année 2021\s*<span class="badge bg-primary rounded-pill">1<\/span>/);
    expect(res.text).toMatch(/SN IR\s*<span class="badge bg-primary rounded-pill">1<\/span>/);
    expect(res.text).toMatch(/CIEL IR\s*<span class="badge bg-primary rounded-pill">1<\/span>/);
  });

  it('should display correct user counts by year', async () => {
    const res = await request(app).get('/admin/statistics');
    expect(res.statusCode).toEqual(200);
    const year2020Match = res.text.match(/Année 2020\s*<span class="badge bg-primary rounded-pill">(\d+)<\/span>/);
    const year2021Match = res.text.match(/Année 2021\s*<span class="badge bg-primary rounded-pill">(\d+)<\/span>/);
    expect(year2020Match).not.toBeNull();
    expect(year2021Match).not.toBeNull();
    expect(parseInt(year2020Match[1])).toEqual(1);
    expect(parseInt(year2021Match[1])).toEqual(1);
  });

  it('should display correct user counts by section', async () => {
    const res = await request(app).get('/admin/statistics');
    expect(res.statusCode).toEqual(200);
    const snIrMatch = res.text.match(/SN IR\s*<span class="badge bg-primary rounded-pill">(\d+)<\/span>/);
    const cielIrMatch = res.text.match(/CIEL IR\s*<span class="badge bg-primary rounded-pill">(\d+)<\/span>/);
    expect(snIrMatch).not.toBeNull();
    expect(cielIrMatch).not.toBeNull();
    expect(parseInt(snIrMatch[1])).toEqual(1);
    expect(parseInt(cielIrMatch[1])).toEqual(1);
  });

  it('should restrict access to non-admin users', async () => {
    // Override mock auth for this test
    const nonAdminApp = express();
    nonAdminApp.use(express.json());
    nonAdminApp.use(express.urlencoded({ extended: false }));
    nonAdminApp.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: true,
    }));
    nonAdminApp.use((req, res, next) => {
      req.user = { id: 2, is_admin: false, is_approved: true, is_active: true };
      req.session.user = { id: 2, is_admin: false, is_approved: true, is_active: true };
      next();
    });
    nonAdminApp.set('view engine', 'ejs');
    nonAdminApp.set('views', './src/views');
    nonAdminApp.use('/admin', adminRoutes);

    const res = await request(nonAdminApp).get('/admin/statistics');
    expect(res.statusCode).toEqual(403);
    expect(res.text).toContain('Accès refusé - Droits administrateur requis');
  });
});