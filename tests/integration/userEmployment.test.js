const { getConnection, releaseConnection } = require('../../src/config/database');
const User = require('../../src/models/User');
const Employer = require('../../src/models/Employer');
const bcrypt = require('bcryptjs');

describe('User Employment Database Interactions', () => {
  let connection;
  const testSectionId = 1;

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

  test('should correctly retrieve user employment details via User.getAll', async () => {
    // Create a user
    const userEmail = `user.employment.${Date.now()}@example.com`;
    const hashedPassword = await bcrypt.hash('password', 10);
    const [userResult] = await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE)',
      [userEmail, hashedPassword, 'Emp', 'User', 2020, testSectionId, true, true]
    );
    const userId = userResult.insertId;

    // Create an employer
    const employerName = `Test Employer ${Date.now()}`;
    const [employerResult] = await connection.query(
      'INSERT INTO employers (nom, secteur, ville) VALUES (?, ?, ?)',
      [employerName, 'IT', 'Paris']
    );
    const employerId = employerResult.insertId;

    // Create a user_employment record
    const position = 'Software Engineer';
    await connection.query(
      'INSERT INTO user_employment (user_id, employer_id, poste, is_current) VALUES (?, ?, ?, TRUE)',
      [userId, employerId, position]
    );

    // Retrieve all users and check for employment details
    const { users } = await User.getAll({}, connection);
    const foundUser = users.find(u => u.id === userId);

    expect(foundUser).toBeDefined();
    expect(foundUser.current_poste).toBe(position);
    expect(foundUser.employer_nom).toBe(employerName);
  });

  test('should correctly retrieve employees for an employer via Employer.getEmployees', async () => {
    // Create an employer
    const employerName = `Employer Employees ${Date.now()}`;
    const [employerResult] = await connection.query(
      'INSERT INTO employers (nom, secteur, ville) VALUES (?, ?, ?)',
      [employerName, 'Finance', 'London']
    );
    const employerId = employerResult.insertId;

    // Create a user
    const userEmail = `employee.${Date.now()}@example.com`;
    const hashedPassword = await bcrypt.hash('password', 10);
    const [userResult] = await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE)',
      [userEmail, hashedPassword, 'Emp', 'One', 2021, testSectionId, true, true]
    );
    const userId = userResult.insertId;

    // Create a user_employment record
    const position = 'Financial Analyst';
    await connection.query(
      'INSERT INTO user_employment (user_id, employer_id, poste, is_current) VALUES (?, ?, ?, TRUE)',
      [userId, employerId, position]
    );

    // Retrieve employees for the employer
    const employees = await Employer.getEmployees(employerId, connection);
    const foundEmployee = employees.find(e => e.id === userId);

    expect(foundEmployee).toBeDefined();
    expect(foundEmployee.email).toBe(userEmail);
    expect(foundEmployee.poste).toBe(position);
    expect(foundEmployee.section_nom).toBe('SN IR');
  });

  test('should allow direct creation and deletion of user_employment records', async () => {
    // Create a user
    const userEmail = `direct.crud.${Date.now()}@example.com`;
    const hashedPassword = await bcrypt.hash('password', 10);
    const [userResult] = await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE)',
      [userEmail, hashedPassword, 'Direct', 'CRUD', 2022, testSectionId, true, true]
    );
    const userId = userResult.insertId;

    // Create an employer
    const employerName = `Direct CRUD Employer ${Date.now()}`;
    const [employerResult] = await connection.query(
      'INSERT INTO employers (nom, secteur, ville) VALUES (?, ?, ?)',
      [employerName, 'Tech', 'San Francisco']
    );
    const employerId = employerResult.insertId;

    // Direct INSERT
    const [insertEmploymentResult] = await connection.query(
      'INSERT INTO user_employment (user_id, employer_id, poste, is_current) VALUES (?, ?, ?, TRUE)',
      [userId, employerId, 'Directly Inserted Role']
    );
    const employmentId = insertEmploymentResult.insertId;

    let [checkRows] = await connection.query('SELECT * FROM user_employment WHERE id = ?', [employmentId]);
    expect(checkRows.length).toBe(1);
    expect(checkRows[0].poste).toBe('Directly Inserted Role');

    // Direct UPDATE
    await connection.query('UPDATE user_employment SET poste = ? WHERE id = ?', ['Updated Role', employmentId]);
    [checkRows] = await connection.query('SELECT * FROM user_employment WHERE id = ?', [employmentId]);
    expect(checkRows.length).toBe(1);
    expect(checkRows[0].poste).toBe('Updated Role');

    // Direct DELETE
    const [deleteResult] = await connection.query('DELETE FROM user_employment WHERE id = ?', [employmentId]);
    expect(deleteResult.affectedRows).toBe(1);

    [checkRows] = await connection.query('SELECT * FROM user_employment WHERE id = ?', [employmentId]);
    expect(checkRows.length).toBe(0);
  });
});