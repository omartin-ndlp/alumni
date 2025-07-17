const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Mock the database connection
const mockExecute = jest.fn();
const mockGetConnection = jest.fn(() => ({
  execute: mockExecute,
}));

jest.mock('../../src/config/database', () => ({
  getConnection: mockGetConnection,
  releaseConnection: jest.fn(), // Mock releaseConnection
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn((password) => Promise.resolve(`hashed_${password}`)),
  compare: jest.fn((plain, hashed) => Promise.resolve(plain === hashed.replace('hashed_', ''))),
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({ toString: () => 'mock_key' })),
}));

const User = require('../../src/models/User');

describe('User Model', () => {
  beforeEach(() => {
    // Clear and reset all mocks before each test
    mockExecute.mockReset();
    mockGetConnection.mockReset().mockImplementation(() => ({
      execute: mockExecute,
    }));
    bcrypt.hash.mockClear();
    bcrypt.compare.mockClear();
    crypto.randomBytes.mockClear();
  });

  // ... (keep existing tests for findByEmail, findById, create, etc.)
  describe('findByEmail', () => {
    test('should return a user if found', async () => {
      const mockUser = { id: 1, email: 'test@example.com', section_nom: 'Informatique' };
      mockExecute.mockResolvedValueOnce([[mockUser]]);

      const user = await User.findByEmail('test@example.com');
      expect(user).toEqual(mockUser);
      expect(mockGetConnection).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(expect.any(String), ['test@example.com']);
    });

    test('should return undefined if user not found', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const user = await User.findByEmail('nonexistent@example.com');
      expect(user).toBeUndefined();
    });
  });

  describe('findById', () => {
    test('should return a user if found by ID', async () => {
      const mockUser = { id: 1, email: 'test@example.com', section_nom: 'Informatique' };
      mockExecute.mockResolvedValueOnce([[mockUser]]);

      const user = await User.findById(1);
      expect(user).toEqual(mockUser);
      expect(mockGetConnection).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(expect.any(String), [1]);
    });

    test('should return undefined if user not found by ID', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const user = await User.findById(999);
      expect(user).toBeUndefined();
    });
  });

  describe('create', () => {
    test('should create a new user and return the insertId', async () => {
      const userData = {
        email: 'new@example.com',
        password: 'password123',
        prenom: 'John',
        nom: 'Doe',
        annee_diplome: 2020,
        section_id: 1,
      };
      mockExecute.mockResolvedValueOnce([{ insertId: 10 }]);

      const createdUser = await User.create(userData);
      expect(createdUser).toEqual({ id: 10, ...userData });
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockExecute).toHaveBeenCalledWith(expect.any(String), [
        userData.email,
        `hashed_${userData.password}`,
        userData.prenom,
        userData.nom,
        userData.annee_diplome,
        userData.section_id,
      ]);
    });
  });

  describe('verifyPassword', () => {
    test('should return true for correct password', async () => {
      const result = await User.verifyPassword('password123', 'hashed_password123');
      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_password123');
    });

    test('should return false for incorrect password', async () => {
      const result = await User.verifyPassword('wrongpassword', 'hashed_password123');
      expect(result).toBe(false);
    });
  });

  describe('updateLastLogin', () => {
    test('should update the last_login timestamp for a user', async () => {
      mockExecute.mockResolvedValueOnce([{}]); // Mock a successful update

      await User.updateLastLogin(1);
      expect(mockExecute).toHaveBeenCalledWith('UPDATE users SET last_login = NOW() WHERE id = ?', [1]);
    });
  });

  describe('getAll', () => {
    test('should return all approved and active users with default filters', async () => {
      const mockUsers = [{ id: 1, email: 'user1@example.com' }];
      // Mock for count and for data
      mockExecute.mockResolvedValueOnce([[{ total: 1 }]]).mockResolvedValueOnce([mockUsers]);

      const { users, total } = await User.getAll();
      expect(total).toBe(1);
      expect(users).toEqual(mockUsers);
      // Check that both queries were executed
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('COUNT(DISTINCT u.id) as total'), expect.any(Array));
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('SELECT'), expect.any(Array));
    });

    test('should apply filters for annee_diplome, section_id, and employer_id', async () => {
      const filters = { annee_diplome: 2020, section_id: 2, employer_id: 5 };
      mockExecute.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);

      await User.getAll(filters);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('u.annee_diplome = ?'),
        expect.arrayContaining([2020])
      );
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('u.section_id = ?'),
        expect.arrayContaining([2])
      );
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('ue.employer_id = ?'),
        expect.arrayContaining([5])
      );
    });

    test('should apply search filter', async () => {
      const filters = { search: 'John' };
      mockExecute.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);

      await User.getAll(filters);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('(LOWER(u.nom) LIKE ? OR LOWER(u.prenom) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(e.nom) LIKE ?)'),
        expect.arrayContaining(['%john%', '%john%', '%john%', '%john%'])
      );
    });

    test('should exclude admins by default', async () => {
      mockExecute.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);

      await User.getAll({});
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('u.is_admin = FALSE'),
        expect.any(Array)
      );
    });

    test('should include admins if show_admins is true', async () => {
      mockExecute.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);

      await User.getAll({ show_admins: true });
      expect(mockExecute).not.toHaveBeenCalledWith(
        expect.stringContaining('u.is_admin = FALSE'),
        expect.any(Array)
      );
    });

    test('should apply sorting by name', async () => {
      mockExecute.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);

      await User.getAll({ sortBy: 'name' });
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY u.nom ASC, u.prenom ASC'),
        expect.any(Array)
      );
    });

    test('should apply sorting by year', async () => {
      mockExecute.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);

      await User.getAll({ sortBy: 'year' });
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY u.annee_diplome DESC, u.nom ASC, u.prenom ASC'),
        expect.any(Array)
      );
    });

    test('should apply sorting by section', async () => {
      mockExecute.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);

      await User.getAll({ sortBy: 'section' });
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY s.nom ASC, u.annee_diplome DESC, u.nom ASC'),
        expect.any(Array)
      );
    });

    test('should apply sorting by employer', async () => {
      mockExecute.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);

      await User.getAll({ sortBy: 'employer' });
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY e.nom ASC, u.nom ASC, u.prenom ASC'),
        expect.any(Array)
      );
    });

    test('should apply pagination (limit and offset)', async () => {
      const filters = { limit: 10, offset: 20 };
      mockExecute.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);

      await User.getAll(filters);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ? OFFSET ?'),
        expect.arrayContaining([10, 20])
      );
    });
  });

  describe('updateProfile', () => {
    test('should update user profile with valid data', async () => {
      const profileData = { prenom: 'Jane', ville: 'Paris' };
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const result = await User.updateProfile(1, profileData, 'user');
      expect(result).toBe(true);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.any(String),
        ['Jane', 'Paris', 1]
      );
    });

    test('should throw error if no valid data to update', async () => {
      const profileData = { invalidField: 'value' };
      await expect(User.updateProfile(1, profileData, 'user')).rejects.toThrow('Aucune donnée valide à mettre à jour');
      expect(mockExecute).not.toHaveBeenCalled();
    });

    test('should return false if no rows affected', async () => {
      const profileData = { prenom: 'Jane' };
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const result = await User.updateProfile(1, profileData, 'user');
      expect(result).toBe(false);
    });
  });

  describe('getPendingApprovals', () => {
    test('should return a list of pending registration requests', async () => {
      const mockRequests = [{ id: 1, email: 'pending@example.com', section_nom: 'Arts' }];
      mockExecute.mockResolvedValueOnce([mockRequests]);

      const requests = await User.getPendingApprovals();
      expect(requests).toEqual(mockRequests);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('FROM registration_requests rr'));
    });
  });

  describe('generateRegistrationKey', () => {
    test('should generate a key and update the database', async () => {
      mockExecute.mockResolvedValueOnce([{}]); // Mock successful update
      const key = await User.generateRegistrationKey(1);

      expect(key).toBe('mock_key');
      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      expect(mockExecute).toHaveBeenCalledWith(
        'UPDATE registration_requests SET registration_key = ?, key_generated_at = NOW() WHERE id = ?',
        ['mock_key', 1]
      );
    });
  });

  describe('findRegistrationRequestByKey', () => {
    test('should return a request if found', async () => {
      const mockRequest = { id: 1, email: 'test@example.com', registration_key: 'mock_key' };
      mockExecute.mockResolvedValueOnce([[mockRequest]]);

      const request = await User.findRegistrationRequestByKey('mock_key');
      expect(request).toEqual(mockRequest);
      expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM registration_requests WHERE registration_key = ?', ['mock_key']);
    });

    test('should return undefined if not found', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const request = await User.findRegistrationRequestByKey('not_a_key');
      expect(request).toBeUndefined();
    });
  });

  describe('completeRegistration', () => {
    const mockRequest = { id: 1, email: 'complete@example.com', prenom: 'Comp', nom: 'Lete', annee_diplome: 2022, section_id: 1 };

    test('should create a new user if one does not exist', async () => {
      // 1. Find request by key -> found
      // 2. Find user by email -> not found
      // 3. Insert new user -> success
      // 4. Delete request -> success
      mockExecute
        .mockResolvedValueOnce([[mockRequest]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 123 }])
        .mockResolvedValueOnce([{}]);

      const userId = await User.completeRegistration('mock_key', 'password123', {});

      expect(userId).toBe(123);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO users'), expect.any(Array));
      expect(mockExecute).toHaveBeenCalledWith('DELETE FROM registration_requests WHERE id = ?', [mockRequest.id]);
    });

    test('should update an existing user', async () => {
      const existingUser = { id: 456, email: mockRequest.email };
      // 1. Find request by key -> found
      // 2. Find user by email -> found
      // 3. Update existing user -> success
      // 4. Delete request -> success
      mockExecute
        .mockResolvedValueOnce([[mockRequest]])
        .mockResolvedValueOnce([[existingUser]])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([{}]);

      const userId = await User.completeRegistration('mock_key', 'new_password', {});

      expect(userId).toBe(456);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE users'), expect.any(Array));
      expect(mockExecute).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO users'), expect.any(Array));
    });

    test('should update profile data if provided', async () => {
      const profileData = { ville: 'Lyon', telephone: '12345' };
      mockExecute
        .mockResolvedValueOnce([[mockRequest]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 123 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // Mock updateProfile
        .mockResolvedValueOnce([{}]);

      await User.completeRegistration('mock_key', 'password123', profileData);

      // Check that updateProfile was called correctly
      const updateCall = mockExecute.mock.calls.find(call => call[0].includes('UPDATE users SET'));
      expect(updateCall[0]).toContain('ville = ?');
      expect(updateCall[0]).toContain('telephone = ?');
      expect(updateCall[1]).toEqual(['Lyon', '12345', 123]);
    });

    test('should NOT update profile if data is empty', async () => {
      mockExecute
        .mockResolvedValueOnce([[mockRequest]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 123 }])
        .mockResolvedValueOnce([{}]);

      await User.completeRegistration('mock_key', 'password123', {});

      const updateCall = mockExecute.mock.calls.find(call => call[0].includes('UPDATE users SET'));
      expect(updateCall).toBeUndefined();
    });

    test('should throw error for invalid key', async () => {
      mockExecute.mockResolvedValueOnce([[]]); // Mock request not found
      await expect(User.completeRegistration('invalid_key', 'pw')).rejects.toThrow('Lien d\'inscription invalide ou expiré.');
    });
  });

  describe('rejectRegistrationRequest', () => {
    test('should delete a request and return true', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const result = await User.rejectRegistrationRequest(1);
      expect(result).toBe(true);
      expect(mockExecute).toHaveBeenCalledWith('DELETE FROM registration_requests WHERE id = ?', [1]);
    });

    test('should return false if no request was deleted', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 }]);
      const result = await User.rejectRegistrationRequest(999);
      expect(result).toBe(false);
    });
  });

  describe('cleanUpRegistrationRequests', () => {
    test('should delete registration requests for approved users', async () => {
      mockExecute.mockResolvedValueOnce([{}]); // Mock successful deletion

      await User.cleanUpRegistrationRequests();
      expect(mockExecute).toHaveBeenCalledWith(expect.stringMatching(/DELETE rr FROM registration_requests rr\s+JOIN users u ON rr.email = u.email\s+WHERE u.is_approved = TRUE/));
    });
  });
});