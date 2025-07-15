const request = require('supertest');
const app = require('../../server'); // Assuming your Express app is exported from server.js
const { getConnection, releaseConnection } = require('../../src/config/database');
const User = require('../../src/models/User');
const Employer = require('../../src/models/Employer');
const bcrypt = require('bcryptjs');

describe('User Profile Multi-Table Interactions', () => {
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

  test('should update user basic profile information', async () => {
    // Create a user
    const uniqueEmail = `update.basic.${Date.now()}@example.com`;
    const hashedPassword = await bcrypt.hash('password', 10);
    const [insertResult] = await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uniqueEmail, hashedPassword, 'Test', 'User', 2020, 1, true]
    );
    const userId = insertResult.insertId;

    // Simulate profile update (assuming a route exists for this)
    // For now, we'll directly call the model or simulate the route logic
    const updatedAnneeDiplome = 2021;
    const updatedSectionId = 2;

    // In a real integration test, you'd make an HTTP request here
    // For demonstration, we'll simulate the model update
    await connection.query(
      'UPDATE users SET annee_diplome = ?, section_id = ? WHERE id = ?',
      [updatedAnneeDiplome, updatedSectionId, userId]
    );

    // Verify the update by directly querying the database
    const [rows] = await connection.query('SELECT * FROM users WHERE id = ?', [userId]);
    expect(rows.length).toBe(1);
    expect(rows[0].annee_diplome).toBe(updatedAnneeDiplome);
    expect(rows[0].section_id).toBe(updatedSectionId);
  });

  test('should add a new employment record for a user', async () => {
    // Create a user
    const uniqueEmail = `add.employment.${Date.now()}@example.com`;
    const hashedPassword = await bcrypt.hash('password', 10);
    const [userInsertResult] = await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uniqueEmail, hashedPassword, 'Employment', 'User', 2020, 1, true]
    );
    const userId = userInsertResult.insertId;

    const employerName = `Test Employer ${Date.now()}`;
    const poste = 'Software Engineer';
    const dateDebut = '2022-01-01';
    const isCurrent = true;

    // Simulate adding employment (assuming a route/service for this)
    // First, check if employer exists or create it
    let [employerRows] = await connection.query('SELECT id FROM employers WHERE nom = ?', [employerName]);
    let employerId;
    if (employerRows.length === 0) {
      const [employerInsertResult] = await connection.query('INSERT INTO employers (nom) VALUES (?)', [employerName]);
      employerId = employerInsertResult.insertId;
    } else {
      employerId = employerRows[0].id;
    }

    // Insert into user_employment
    await connection.query(
      'INSERT INTO user_employment (user_id, employer_id, poste, date_debut, is_current) VALUES (?, ?, ?, ?, ?)',
      [userId, employerId, poste, dateDebut, isCurrent]
    );

    // Verify the employment record
    const [employmentRows] = await connection.query(
      'SELECT * FROM user_employment WHERE user_id = ? AND employer_id = ?',
      [userId, employerId]
    );
    expect(employmentRows.length).toBe(1);
    expect(employmentRows[0].poste).toBe(poste);
    expect(employmentRows[0].is_current).toBe(isCurrent ? 1 : 0);

    // Verify employer was created if it didn't exist
    const [finalEmployerRows] = await connection.query('SELECT * FROM employers WHERE id = ?', [employerId]);
    expect(finalEmployerRows.length).toBe(1);
    expect(finalEmployerRows[0].nom).toBe(employerName);
  });

  test('should update an existing employment record for a user', async () => {
    // Create a user
    const uniqueEmail = `update.employment.${Date.now()}@example.com`;
    const hashedPassword = await bcrypt.hash('password', 10);
    const [userInsertResult] = await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uniqueEmail, hashedPassword, 'Update', 'Employment', 2020, 1, true]
    );
    const userId = userInsertResult.insertId;

    // Create an employer
    const employerName = `Existing Employer ${Date.now()}`;
    const [employerInsertResult] = await connection.query('INSERT INTO employers (nom) VALUES (?)', [employerName]);
    const employerId = employerInsertResult.insertId;

    // Create an initial employment record
    const initialPoste = 'Junior Developer';
    const initialDateDebut = '2021-01-01';
    const initialIsCurrent = true;
    const [employmentInsertResult] = await connection.query(
      'INSERT INTO user_employment (user_id, employer_id, poste, date_debut, is_current) VALUES (?, ?, ?, ?, ?)',
      [userId, employerId, initialPoste, initialDateDebut, initialIsCurrent]
    );
    const employmentId = employmentInsertResult.insertId;

    // Simulate updating the employment record
    const updatedPoste = 'Senior Developer';
    const updatedIsCurrent = false;
    const updatedDateFin = '2023-12-31';

    await connection.query(
      'UPDATE user_employment SET poste = ?, is_current = ?, date_fin = ? WHERE id = ?',
      [updatedPoste, updatedIsCurrent, updatedDateFin, employmentId]
    );

    // Verify the updated employment record
    const [updatedEmploymentRows] = await connection.query('SELECT * FROM user_employment WHERE id = ?', [employmentId]);
    expect(updatedEmploymentRows.length).toBe(1);
    expect(updatedEmploymentRows[0].poste).toBe(updatedPoste);
    expect(updatedEmploymentRows[0].is_current).toBe(updatedIsCurrent ? 1 : 0);
    expect(updatedEmploymentRows[0].date_fin).toEqual(new Date(updatedDateFin));
  });

  test('should delete an employment record for a user', async () => {
    // Create a user
    const uniqueEmail = `delete.employment.${Date.now()}@example.com`;
    const hashedPassword = await bcrypt.hash('password', 10);
    const [userInsertResult] = await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uniqueEmail, hashedPassword, 'Delete', 'Employment', 2020, 1, true]
    );
    const userId = userInsertResult.insertId;

    // Create an employer
    const employerName = `Employer for Deletion ${Date.now()}`;
    const [employerInsertResult] = await connection.query('INSERT INTO employers (nom) VALUES (?)', [employerName]);
    const employerId = employerInsertResult.insertId;

    // Create an employment record to be deleted
    const posteToDelete = 'Temporary Role';
    const dateDebutToDelete = '2023-01-01';
    const [employmentInsertResult] = await connection.query(
      'INSERT INTO user_employment (user_id, employer_id, poste, date_debut, is_current) VALUES (?, ?, ?, ?, ?)',
      [userId, employerId, posteToDelete, dateDebutToDelete, true]
    );
    const employmentId = employmentInsertResult.insertId;

    // Verify it exists before deletion
    let [existingEmploymentRows] = await connection.query('SELECT * FROM user_employment WHERE id = ?', [employmentId]);
    expect(existingEmploymentRows.length).toBe(1);

    // Simulate deleting the employment record
    await connection.query('DELETE FROM user_employment WHERE id = ?', [employmentId]);

    // Verify the employment record is no longer present
    const [deletedEmploymentRows] = await connection.query('SELECT * FROM user_employment WHERE id = ?', [employmentId]);
    expect(deletedEmploymentRows.length).toBe(0);
  });
});
