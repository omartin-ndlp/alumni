const request = require('supertest');
const express = require('express');
const session = require('express-session');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const bcrypt = require('bcryptjs');
const authRouter = require('../../src/routes/auth');
const addUserToLocals = require('../../src/middleware/auth');
const { getConnection } = require('../../src/config/database');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
app.use(addUserToLocals);

// Configure view engine
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../../src', 'views'));
app.set('layout', 'layout');

app.use('/', authRouter);

describe('Auth Routes', () => {
  let db;

  beforeAll(async () => {
    db = getConnection();
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('password', salt);
    await db.execute('DELETE FROM users');
    await db.execute(`
      INSERT INTO users (nom, prenom, email, password_hash, annee_diplome, section_id, is_approved, is_active)
      VALUES ('Test', 'User', 'test@example.com', ?, 2023, 1, TRUE, TRUE)
    `, [hashedPassword]);
  });

  it('should login with correct credentials and redirect to dashboard', async () => {
    const res = await request(app)
      .post('/login')
      .send({
        email: 'test@example.com',
        password: 'password'
      });
    expect(res.statusCode).toEqual(302);
    expect(res.headers.location).toBe('/dashboard');
  });

  it('should reject login with incorrect credentials', async () => {
    const res = await request(app)
      .post('/login')
      .send({
        email: 'test@example.com',
        password: 'wrongpassword'
      });
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Email ou mot de passe incorrect');
  });
});
