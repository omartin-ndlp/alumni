const request = require('supertest');
const app = require('../../server');
const { createConnection } = require('../../src/config/database');

describe('Authentication Routes', () => {
  let db;

  beforeAll(async () => {
    db = await createConnection();
    
    // Ajouter une section de test
    await db.execute(`
      INSERT IGNORE INTO sections (nom, description) VALUES 
      ('Test Section', 'Section pour les tests')
    `);
  });

  beforeEach(async () => {
    // Nettoyer les données avant chaque test
    await db.execute('DELETE FROM users');
    await db.execute('DELETE FROM registration_requests');
  });

  describe('GET /login', () => {
    it('should render login page', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200);
        
      expect(response.text).toContain('Connexion');
      expect(response.text).toContain('Anciens BTS SN/CIEL LJV');
    });
  });

  describe('POST /login', () => {
    beforeEach(async () => {
      // Créer un utilisateur test
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('testpassword', 12);
      const [sections] = await db.execute('SELECT id FROM sections LIMIT 1');
      
      await db.execute(`
        INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active)
        VALUES ('test@example.com', ?, 'Test', 'User', 2020, ?, TRUE, TRUE)
      `, [hashedPassword, sections[0].id]);
    });

    it('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword'
        })
        .expect(302);
        
      expect(response.headers.location).toBe('/dashboard');
    });

    it('should reject incorrect password', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
        .expect(200);
        
      expect(response.text).toContain('Email ou mot de passe incorrect');
    });

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'anypassword'
        })
        .expect(200);
        
      expect(response.text).toContain('Email ou mot de passe incorrect');
    });
  });

  describe('GET /register', () => {
    it('should render registration page', async () => {
      const response = await request(app)
        .get('/register')
        .expect(200);
        
      expect(response.text).toContain('Demande de compte');
      expect(response.text).toContain('Test Section');
    });
  });

  describe('POST /register', () => {
    it('should create registration request with valid data', async () => {
      const [sections] = await db.execute('SELECT id FROM sections LIMIT 1');
      
      const response = await request(app)
        .post('/register')
        .send({
          email: 'newuser@example.com',
          prenom: 'New',
          nom: 'User',
          annee_diplome: 2022,
          section_id: sections[0].id
        })
        .expect(200);
        
      expect(response.text).toContain('Demande envoyée');
      
      // Vérifier que la demande a été créée
      const [requests] = await db.execute(
        'SELECT * FROM registration_requests WHERE email = ?',
        ['newuser@example.com']
      );
      expect(requests.length).toBe(1);
    });

    it('should reject duplicate email registration', async () => {
      const [sections] = await db.execute('SELECT id FROM sections LIMIT 1');
      
      // Première inscription
      await request(app)
        .post('/register')
        .send({
          email: 'duplicate@example.com',
          prenom: 'First',
          nom: 'User',
          annee_diplome: 2022,
          section_id: sections[0].id
        });
      
      // Tentative de duplication
      const response = await request(app)
        .post('/register')
        .send({
          email: 'duplicate@example.com',
          prenom: 'Second',
          nom: 'User',
          annee_diplome: 2022,
          section_id: sections[0].id
        })
        .expect(200);
        
      expect(response.text).toContain('Une demande d\'inscription est déjà en cours');
    });

    it('should reject invalid data', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          email: 'invalid-email',
          prenom: '',
          nom: 'User',
          annee_diplome: 1800, // Année invalide
          section_id: 999 // Section inexistante
        })
        .expect(200);
        
      expect(response.text).toContain('Veuillez corriger les erreurs');
    });
  });

  describe('POST /logout', () => {
    it('should logout and redirect to login', async () => {
      const agent = request.agent(app);
      
      // Se connecter d'abord
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('testpassword', 12);
      const [sections] = await db.execute('SELECT id FROM sections LIMIT 1');
      
      await db.execute(`
        INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active)
        VALUES ('test@example.com', ?, 'Test', 'User', 2020, ?, TRUE, TRUE)
      `, [hashedPassword, sections[0].id]);
      
      await agent
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword'
        });
      
      // Se déconnecter
      const response = await agent
        .post('/logout')
        .expect(302);
        
      expect(response.headers.location).toBe('/login');
    });
  });
});
