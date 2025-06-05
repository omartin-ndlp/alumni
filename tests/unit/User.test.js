const User = require('../../src/models/User');
const { createConnection } = require('../../src/config/database');

describe('User Model', () => {
  let db;

  beforeAll(async () => {
    db = await createConnection();
    
    // Ajouter une section de test
    await db.execute(`
      INSERT INTO sections (nom, description) VALUES 
      ('Test Section', 'Section pour les tests')
    `);
  });

  beforeEach(async () => {
    // Nettoyer les utilisateurs avant chaque test
    await db.execute('DELETE FROM users');
    await db.execute('DELETE FROM registration_requests');
  });

  describe('findByEmail', () => {
    it('should return null for non-existent email', async () => {
      const user = await User.findByEmail('nonexistent@test.com');
      expect(user).toBeUndefined();
    });

    it('should return user for existing email', async () => {
      // Créer un utilisateur test
      const [sections] = await db.execute('SELECT id FROM sections LIMIT 1');
      const sectionId = sections[0].id;
      
      await db.execute(`
        INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved)
        VALUES ('test@example.com', 'hashedpassword', 'John', 'Doe', 2020, ?, TRUE)
      `, [sectionId]);

      const user = await User.findByEmail('test@example.com');
      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.prenom).toBe('John');
      expect(user.nom).toBe('Doe');
    });
  });

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      const [sections] = await db.execute('SELECT id FROM sections LIMIT 1');
      const sectionId = sections[0].id;

      const userData = {
        email: 'newuser@test.com',
        password: 'plainpassword',
        prenom: 'Jane',
        nom: 'Smith',
        annee_diplome: 2021,
        section_id: sectionId
      };

      const userId = await User.create(userData);
      expect(userId).toBeDefined();
      expect(typeof userId).toBe('number');

      // Vérifier que l'utilisateur a été créé
      const user = await User.findByEmail('newuser@test.com');
      expect(user).toBeDefined();
      expect(user.prenom).toBe('Jane');
      expect(user.nom).toBe('Smith');
      expect(user.is_approved).toBe(0); // FALSE en MySQL
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const bcrypt = require('bcryptjs');
      const plainPassword = 'testpassword';
      const hashedPassword = await bcrypt.hash(plainPassword, 12);

      const isValid = await User.verifyPassword(plainPassword, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('correctpassword', 12);

      const isValid = await User.verifyPassword('wrongpassword', hashedPassword);
      expect(isValid).toBe(false);
    });
  });

  describe('getAll', () => {
    beforeEach(async () => {
      // Créer quelques utilisateurs test
      const [sections] = await db.execute('SELECT id FROM sections LIMIT 1');
      const sectionId = sections[0].id;

      await db.execute(`
        INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active)
        VALUES 
        ('user1@test.com', 'hash1', 'Alice', 'Johnson', 2020, ?, TRUE, TRUE),
        ('user2@test.com', 'hash2', 'Bob', 'Wilson', 2021, ?, TRUE, TRUE),
        ('user3@test.com', 'hash3', 'Charlie', 'Brown', 2020, ?, FALSE, TRUE)
      `, [sectionId, sectionId, sectionId]);
    });

    it('should return only approved users by default', async () => {
      const users = await User.getAll();
      expect(users.length).toBe(2); // Seulement les approuvés
    });

    it('should filter by graduation year', async () => {
      const users = await User.getAll({ annee_diplome: 2020 });
      expect(users.length).toBe(1); // Alice seulement (Bob n'est pas approuvé)
      expect(users[0].prenom).toBe('Alice');
    });

    it('should search by name', async () => {
      const users = await User.getAll({ search: 'Alice' });
      expect(users.length).toBe(1);
      expect(users[0].prenom).toBe('Alice');
    });
  });
});
