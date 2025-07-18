const request = require('supertest');
const express = require('express');
const session = require('express-session');
const adminRoutes = require('../../src/routes/admin');
const { getConnection, releaseConnection } = require('../../src/config/database');

describe('Employer Export Feature', () => {
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
    await db.execute("SET FOREIGN_KEY_CHECKS = 1;");
    // Seed data
    await db.execute("INSERT INTO sections (id, nom) VALUES (1, 'SN IR'), (2, 'CIEL IR'), (3, 'SN EC');");
    await db.execute("INSERT INTO users (id, nom, prenom, email, password_hash, section_id, annee_diplome, is_approved, is_active, is_admin) VALUES (1, 'Admin', 'User', 'admin@test.com', 'password', 1, 2020, TRUE, TRUE, TRUE), (2, 'Test', 'User', 'test@test.com', 'password', 2, 2021, TRUE, TRUE, FALSE);");
    await db.execute("INSERT INTO employers (id, nom, ville, secteur) VALUES (1, 'Renault Trucks', 'Lyon', 'Automobile'), (2, 'Chez Renault Cafe', 'Paris', 'Restauration'), (3, 'Google', 'Paris', 'Tech');");
    await db.execute("INSERT INTO user_employment (user_id, employer_id, poste) VALUES (1, 1, 'Développeur'), (2, 2, 'Barista'), (2, 3, 'Ingénieur');");
  });

  afterEach(async () => {
    await db.rollback();
    db.release();
  });

  it('should render the export page with cities and sections', async () => {
    const res = await request(app).get('/admin/export/employers');
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Lyon');
    expect(res.text).toContain('Paris');
    expect(res.text).toContain('SN IR');
    expect(res.text).toContain('CIEL IR');
  });

  it('should export employers as CSV', async () => {
    const res = await request(app)
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
    const res = await request(app)
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
    const res = await request(app)
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
