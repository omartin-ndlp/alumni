const { getConnection, releaseConnection } = require('../../src/config/database');
const bcrypt = require('bcryptjs');

describe('Advanced Database Interactions and Constraints', () => {
  let connection;

  beforeEach(async () => {
    connection = await getConnection();
    await connection.beginTransaction();
  });

  afterEach(async () => {
    await connection.rollback();
    if (connection === global.__TEST_DB_CONNECTION__) {
      global.__TEST_DB_CONNECTION__ = null; // Clear global connection only if it's the one we set
    }
    releaseConnection(connection);
  });

  // Placeholder test to ensure setup is working
  test('should have a working database connection', async () => {
    const [rows] = await connection.query('SELECT 1 + 1 AS solution');
    expect(rows[0].solution).toBe(2);
  });

  test('should correctly retrieve users with their current employment details', async () => {
    // Setup: Insert users, employers, and employment records
    const hashedPassword = await bcrypt.hash('password', 10);

    // User 1: Current employee
    const [user1Result] = await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['user1@example.com', hashedPassword, 'User1', 'Test', 2020, 1, true]
    );
    const user1Id = user1Result.insertId;
    const [employer1Result] = await connection.query('INSERT INTO employers (nom) VALUES (?)', ['Company A']);
    const employer1Id = employer1Result.insertId;
    await connection.query(
      'INSERT INTO user_employment (user_id, employer_id, poste, date_debut, is_current) VALUES (?, ?, ?, ?, ?)',
      [user1Id, employer1Id, 'Software Engineer', '2022-01-01', true]
    );

    // User 2: Past employee, no current
    const [user2Result] = await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['user2@example.com', hashedPassword, 'User2', 'Test', 2019, 1, true]
    );
    const user2Id = user2Result.insertId;
    const [employer2Result] = await connection.query('INSERT INTO employers (nom) VALUES (?)', ['Company B']);
    const employer2Id = employer2Result.insertId;
    await connection.query(
      'INSERT INTO user_employment (user_id, employer_id, poste, date_debut, date_fin, is_current) VALUES (?, ?, ?, ?, ?, ?)',
      [user2Id, employer2Id, 'Past Role', '2018-01-01', '2021-12-31', false]
    );

    // User 3: No employment
    const [user3Result] = await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['user3@example.com', hashedPassword, 'User3', 'Test', 2021, 1, true]
    );
    const user3Id = user3Result.insertId;

    // Action: Query to retrieve users with current employment
    const [usersWithCurrentEmployment] = await connection.query(`
      SELECT
        u.id, u.email, u.prenom, u.nom,
        ue.poste,
        e.nom AS employer_name
      FROM users u
      JOIN user_employment ue ON u.id = ue.user_id
      JOIN employers e ON ue.employer_id = e.id
      WHERE ue.is_current = TRUE
    `);

    // Assertion: Verify only User 1 is returned with correct details
    expect(usersWithCurrentEmployment.length).toBe(1);
    expect(usersWithCurrentEmployment[0].id).toBe(user1Id);
    expect(usersWithCurrentEmployment[0].email).toBe('user1@example.com');
    expect(usersWithCurrentEmployment[0].poste).toBe('Software Engineer');
    expect(usersWithCurrentEmployment[0].employer_name).toBe('Company A');
  });

  test('should correctly count users by section and year', async () => {
    // Setup: Insert users with varying sections and diploma years
    const hashedPassword = await bcrypt.hash('password', 10);

    // Users for Section 1
    await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['s1y2020_1@example.com', hashedPassword, 'User', 'S1Y2020', 2020, 1, true]
    );
    await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['s1y2020_2@example.com', hashedPassword, 'User', 'S1Y2020', 2020, 1, true]
    );
    await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['s1y2021_1@example.com', hashedPassword, 'User', 'S1Y2021', 2021, 1, true]
    );

    // Users for Section 2
    await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['s2y2020_1@example.com', hashedPassword, 'User', 'S2Y2020', 2020, 2, true]
    );
    await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['s2y2021_1@example.com', hashedPassword, 'User', 'S2Y2021', 2021, 2, true]
    );

    // Action: Query to count users by section
    const [usersBySection] = await connection.query(`
      SELECT s.nom AS section_name, COUNT(u.id) AS user_count
      FROM sections s
      LEFT JOIN users u ON s.id = u.section_id
      WHERE u.is_approved = TRUE
      GROUP BY s.nom
      ORDER BY s.nom
    `);

    // Assertion: Verify counts by section
    expect(usersBySection).toEqual(expect.arrayContaining([
      expect.objectContaining({ section_name: 'SN IR', user_count: 3 }),
      expect.objectContaining({ section_name: 'SN ER', user_count: 2 }),
    ]));

    // Action: Query to count users by year
    const [usersByYear] = await connection.query(`
      SELECT annee_diplome, COUNT(id) AS user_count
      FROM users
      WHERE is_approved = TRUE
      GROUP BY annee_diplome
      ORDER BY annee_diplome
    `);

    // Assertion: Verify counts by year
    expect(usersByYear).toEqual(expect.arrayContaining([
      expect.objectContaining({ annee_diplome: 2020, user_count: 3 }),
      expect.objectContaining({ annee_diplome: 2021, user_count: 2 }),
    ]));
  });

  test('should prevent duplicate user emails due to unique constraint', async () => {
    // Setup: Insert a user
    const email = 'duplicate@example.com';
    const hashedPassword = await bcrypt.hash('password', 10);
    await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, 'First', 'User', 2020, 1, true]
    );

    // Action: Attempt to insert another user with the same email
    const duplicateEmail = email;
    const duplicateHashedPassword = await bcrypt.hash('another_password', 10);

    await expect(connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [duplicateEmail, duplicateHashedPassword, 'Second', 'User', 2021, 1, true]
    )).rejects.toThrow(/Duplicate entry/); // Expect a duplicate entry error
  });

  test('should prevent inserting user with non-existent section_id due to foreign key constraint', async () => {
    // Setup: No specific setup needed, just ensure section_id 999 does not exist
    const email = 'fk_test@example.com';
    const hashedPassword = await bcrypt.hash('password', 10);
    const nonExistentSectionId = 999;

    // Action: Attempt to insert a user with a non-existent section_id
    await expect(connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, 'FK', 'Test', 2022, nonExistentSectionId, true]
    )).rejects.toThrow(/Cannot add or update a child row/); // Expect a foreign key constraint error
  });

  test('should prevent inserting user with missing NOT NULL columns', async () => {
    const hashedPassword = await bcrypt.hash('password', 10);

    // Attempt to insert a user without an email (NOT NULL)
    await expect(connection.query(
      'INSERT INTO users (password_hash, prenom, nom, annee_diplome, section_id, is_approved) VALUES (?, ?, ?, ?, ?, ?)',
      [hashedPassword, 'NoEmail', 'Test', 2020, 1, true]
    )).rejects.toThrow(/Field 'email' doesn't have a default value/); // Expect a NOT NULL constraint error

    // Attempt to insert a user without a password_hash (NOT NULL)
    await expect(connection.query(
      'INSERT INTO users (email, prenom, nom, annee_diplome, section_id, is_approved) VALUES (?, ?, ?, ?, ?, ?)',
      ['no_password@example.com', 'NoPass', 'Test', 2020, 1, true]
    )).rejects.toThrow(/Field 'password_hash' doesn't have a default value/); // Expect a NOT NULL constraint error
  });

  test('should delete user_employment records when user is deleted (ON DELETE CASCADE)', async () => {
    // Setup: Insert a user and associated employment records
    const hashedPassword = await bcrypt.hash('password', 10);
    const [userResult] = await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['cascade_user@example.com', hashedPassword, 'Cascade', 'User', 2020, 1, true]
    );
    const userId = userResult.insertId;

    const [employer1Result] = await connection.query('INSERT INTO employers (nom) VALUES (?)', ['Employer X']);
    const employer1Id = employer1Result.insertId;
    await connection.query(
      'INSERT INTO user_employment (user_id, employer_id, poste, date_debut, is_current) VALUES (?, ?, ?, ?, ?)',
      [userId, employer1Id, 'Role 1', '2020-01-01', true]
    );

    const [employer2Result] = await connection.query('INSERT INTO employers (nom) VALUES (?)', ['Employer Y']);
    const employer2Id = employer2Result.insertId;
    await connection.query(
      'INSERT INTO user_employment (user_id, employer_id, poste, date_debut, is_current) VALUES (?, ?, ?, ?, ?)',
      [userId, employer2Id, 'Role 2', '2021-01-01', false]
    );

    // Verify employment records exist before deletion
    let [employmentRecords] = await connection.query('SELECT * FROM user_employment WHERE user_id = ?', [userId]);
    expect(employmentRecords.length).toBe(2);

    // Action: Delete the user
    await connection.query('DELETE FROM users WHERE id = ?', [userId]);

    // Assertion: Verify employment records are deleted
    [employmentRecords] = await connection.query('SELECT * FROM user_employment WHERE user_id = ?', [userId]);
    expect(employmentRecords.length).toBe(0);
  });

  test('should prevent deleting a section referenced by a registration request (ON DELETE RESTRICT/NO ACTION)', async () => {
    // Setup: Insert a section and a registration request referencing it
    const [sectionResult] = await connection.query('INSERT INTO sections (nom) VALUES (?)', ['Test Section for FK']);
    const sectionId = sectionResult.insertId;

    await connection.query(
      'INSERT INTO registration_requests (email, prenom, nom, annee_diplome, section_id, message) VALUES (?, ?, ?, ?, ?, ?)',
      ['fk_request@example.com', 'FK', 'Request', 2024, sectionId, 'Test message']
    );

    // Action: Attempt to delete the section
    await expect(connection.query('DELETE FROM sections WHERE id = ?', [sectionId]))
      .rejects.toThrow(/Cannot delete or update a parent row/); // Expect a foreign key constraint error
  });
});
