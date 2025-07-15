const { getConnection, releaseConnection } = require('../../src/config/database');
const User = require('../../src/models/User');
const bcrypt = require('bcryptjs');

describe('User.getAll()', () => {
  let insertedUserIds; // Declare insertedUserIds here

  beforeEach(async () => {
    connection = await getConnection();
    await connection.beginTransaction();

    // Seed the database with test data
    // Sections are now seeded globally in globalSetup.js
    // Employers are now seeded locally to ensure availability
    await connection.query("INSERT INTO employers (id, nom) VALUES (1, 'Google'), (2, 'Microsoft'), (3, 'Apple') ON DUPLICATE KEY UPDATE nom=VALUES(nom)");

    const usersData = [
      { email: 'alice@example.com', prenom: 'Alice', nom: 'Smith', annee_diplome: 2020, section_id: 1, created_at: '2023-01-01 10:00:00' },
      { email: 'bob@example.com', prenom: 'Bob', nom: 'Johnson', annee_diplome: 2021, section_id: 2, created_at: '2023-01-02 11:00:00' },
      { email: 'charlie@example.com', prenom: 'Charlie', nom: 'Williams', annee_diplome: 2020, section_id: 1, created_at: '2023-01-03 12:00:00' },
      { email: 'david@example.com', prenom: 'David', nom: 'Brown', annee_diplome: 2022, section_id: 3, created_at: '2023-01-04 13:00:00' },
      { email: 'eve@example.com', prenom: 'Eve', nom: 'Jones', annee_diplome: 2021, section_id: 2, created_at: '2023-01-05 14:00:00' },
    ];

    const password_hash = await bcrypt.hash('password123', 10);
    insertedUserIds = []; // Initialize it here

    for (const user of usersData) {
      const [result] = await connection.query(
        "INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, true, true, ?)",
        [user.email, password_hash, user.prenom, user.nom, user.annee_diplome, user.section_id, user.created_at]
      );
      insertedUserIds.push(result.insertId);
    }

    const employmentsData = [
        { user_index: 0, employer_id: 1, poste: 'Software Engineer' }, // Alice
        { user_index: 1, employer_id: 2, poste: 'Product Manager' }, // Bob
        { user_index: 2, employer_id: 3, poste: 'UI/UX Designer' }, // Charlie
        { user_index: 3, employer_id: 1, poste: 'Data Scientist' }, // David
        { user_index: 4, employer_id: 2, poste: 'Software Engineer' }, // Eve
    ];

    for (const employment of employmentsData) {
        await connection.query(
            "INSERT INTO user_employment (user_id, employer_id, poste, is_current) VALUES (?, ?, ?, true)",
            [insertedUserIds[employment.user_index], employment.employer_id, employment.poste]
        );
    }
  });

  afterEach(async () => {
    await connection.rollback();
    if (connection === global.__TEST_DB_CONNECTION__) {
      global.__TEST_DB_CONNECTION__ = null; // Clear global connection only if it's the one we set
    }
    releaseConnection(connection);
  });

  // Test various filtering combinations
  test('should filter by annee_diplome', async () => {
    const { users, total } = await User.getAll({ annee_diplome: 2020 }, connection);
    expect(total).toBe(2);
    expect(users.map(u => u.id)).toEqual(expect.arrayContaining([insertedUserIds[0], insertedUserIds[2]]));
  });

  test('should filter by section_id', async () => {
    const { users, total } = await User.getAll({ section_id: 2 }, connection);
    expect(total).toBe(2);
    expect(users.map(u => u.id)).toEqual(expect.arrayContaining([insertedUserIds[1], insertedUserIds[4]]));
  });

  test('should filter by employer_id', async () => {
    const { users, total } = await User.getAll({ employer_id: 1 }, connection);
    expect(total).toBe(2);
    expect(users.map(u => u.id)).toEqual(expect.arrayContaining([insertedUserIds[0], insertedUserIds[3]]));
  });

  test('should filter by a search term (prenom)', async () => {
    const { users, total } = await User.getAll({ search: 'Alice' }, connection);
    expect(total).toBe(1);
    expect(users[0].prenom).toBe('Alice');
  });

    test('should filter by a search term (nom)', async () => {
    const { users, total } = await User.getAll({ search: 'Smith' }, connection);
    expect(total).toBe(1);
    expect(users[0].nom).toBe('Smith');
  });

  test('should filter by a search term (email)', async () => {
    const { users, total } = await User.getAll({ search: 'bob@example.com' }, connection);
    expect(total).toBe(1);
    expect(users[0].email).toBe('bob@example.com');
  });

  test('should handle combined filters (year and section)', async () => {
      const { users, total } = await User.getAll({ annee_diplome: 2021, section_id: 2 }, connection);
      expect(total).toBe(2);
      expect(users.map(u => u.id)).toEqual(expect.arrayContaining([insertedUserIds[1], insertedUserIds[4]]));
  });

    test('should handle combined filters (year and employer)', async () => {
      const { users, total } = await User.getAll({ annee_diplome: 2020, employer_id: 1 }, connection);
      expect(total).toBe(1);
      expect(users[0].id).toBe(insertedUserIds[0]);
  });

  // Test all sorting options
  test('should sort by name (default is ASC)', async () => {
    const { users } = await User.getAll({ sortBy: 'name' }, connection);
    const names = users.map(u => u.nom);
    expect(names).toEqual(['Brown', 'Johnson', 'Jones', 'Smith', 'Williams']);
  });

  test('should sort by year (default is DESC)', async () => {
    const { users } = await User.getAll({ sortBy: 'year' }, connection);
    const years = users.map(u => u.annee_diplome);
    expect(years).toEqual([2022, 2021, 2021, 2020, 2020]);
  });

  test('should sort by section name (default is ASC)', async () => {
    const { users } = await User.getAll({ sortBy: 'section' }, connection);
    const sectionNames = users.map(u => u.section_nom);
    // CIEL IR, SN ER, SN ER, SN IR, SN IR
    expect(sectionNames).toEqual(['CIEL IR', 'SN ER', 'SN ER', 'SN IR', 'SN IR']);
  });

  test('should sort by employer name (default is ASC)', async () => {
    const { users } = await User.getAll({ sortBy: 'employer' }, connection);
    const employerNames = users.map(u => u.employer_nom);
    // Apple, Google, Google, Microsoft, Microsoft
    expect(employerNames).toEqual(expect.arrayContaining(['Apple', 'Google', 'Google', 'Microsoft', 'Microsoft']));
  });

  test('should sort by created_at (default is DESC)', async () => {
    const { users } = await User.getAll({ sortBy: 'created_at' }, connection);
    const ids = users.map(u => u.id);
    expect(ids).toEqual([insertedUserIds[4], insertedUserIds[3], insertedUserIds[2], insertedUserIds[1], insertedUserIds[0]]);
  });

  // Verify pagination
  test('should apply limit and offset for pagination', async () => {
    const { users, total } = await User.getAll({ limit: 2, offset: 0, sortBy: 'name' }, connection);
    expect(total).toBe(5);
    expect(users.length).toBe(2);
    expect(users.map(u => u.nom)).toEqual(['Brown', 'Johnson']);
  });

  test('should apply limit and offset for pagination (page 2)', async () => {
    const { users, total } = await User.getAll({ limit: 2, offset: 2, sortBy: 'name' }, connection);
    expect(total).toBe(5);
    expect(users.length).toBe(2);
    expect(users.map(u => u.nom)).toEqual(['Jones', 'Smith']);
  });

    test('should return correct total when filtering with pagination', async () => {
    const { users, total } = await User.getAll({ annee_diplome: 2020, limit: 1, offset: 0, sortBy: 'name' }, connection);
    expect(total).toBe(2);
    expect(users.length).toBe(1);
    expect(users[0].nom).toBe('Smith');
  });
});
