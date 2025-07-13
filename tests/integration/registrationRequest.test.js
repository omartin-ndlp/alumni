const { getConnection, releaseConnection } = require('../../src/config/database');
const User = require('../../src/models/User');
const bcrypt = require('bcryptjs');

describe('Registration Request Database Interactions', () => {
  let connection;

  beforeEach(async () => {
    connection = await getConnection();
    await connection.beginTransaction();
  });

  afterEach(async () => {
    await connection.rollback();
    releaseConnection(connection);
  });

  test('should retrieve pending registration requests', async () => {
    const requestData = {
      email: `pending.${Date.now()}@example.com`,
      prenom: 'Pending',
      nom: 'User',
      annee_diplome: 2024,
      section_id: 1,
      message: 'Please approve me.'
    };
    await connection.query(
      'INSERT INTO registration_requests (email, prenom, nom, annee_diplome, section_id, message) VALUES (?, ?, ?, ?, ?, ?)',
      [requestData.email, requestData.prenom, requestData.nom, requestData.annee_diplome, requestData.section_id, requestData.message]
    );

    const pendingRequests = await User.getPendingApprovals(connection);
    expect(pendingRequests.length).toBeGreaterThan(0);
    const foundRequest = pendingRequests.find(req => req.email === requestData.email);
    expect(foundRequest).toBeDefined();
    expect(foundRequest.prenom).toBe(requestData.prenom);
  });

  test('should approve a registration request and create a user', async () => {
    const requestData = {
      email: `approve.${Date.now()}@example.com`,
      prenom: 'Approve',
      nom: 'User',
      annee_diplome: 2023,
      section_id: 1,
      message: 'Approve this one.'
    };
    const [insertResult] = await connection.query(
      'INSERT INTO registration_requests (email, prenom, nom, annee_diplome, section_id, message) VALUES (?, ?, ?, ?, ?, ?)',
      [requestData.email, requestData.prenom, requestData.nom, requestData.annee_diplome, requestData.section_id, requestData.message]
    );
    const requestId = insertResult.insertId;

    const isApproved = await User.approveRegistration(requestId, true, connection);
    expect(isApproved).toBe(true);

    // Verify request is deleted
    const [requests] = await connection.query('SELECT * FROM registration_requests WHERE id = ?', [requestId]);
    expect(requests.length).toBe(0);

    // Verify user is created
    const [users] = await connection.query('SELECT * FROM users WHERE email = ?', [requestData.email]);
    expect(users.length).toBe(1);
    expect(users[0].prenom).toBe(requestData.prenom);
    expect(users[0].is_approved).toBe(1); // MySQL boolean is 1 for true
  });

  test('should reject a registration request and not create a user', async () => {
    const requestData = {
      email: `reject.${Date.now()}@example.com`,
      prenom: 'Reject',
      nom: 'User',
      annee_diplome: 2022,
      section_id: 1,
      message: 'Reject this one.'
    };
    const [insertResult] = await connection.query(
      'INSERT INTO registration_requests (email, prenom, nom, annee_diplome, section_id, message) VALUES (?, ?, ?, ?, ?, ?)',
      [requestData.email, requestData.prenom, requestData.nom, requestData.annee_diplome, requestData.section_id, requestData.message]
    );
    const requestId = insertResult.insertId;

    const isRejected = await User.approveRegistration(requestId, false, connection);
    expect(isRejected).toBe(false);

    // Verify request is deleted
    const [requests] = await connection.query('SELECT * FROM registration_requests WHERE id = ?', [requestId]);
    expect(requests.length).toBe(0);

    // Verify user is NOT created
    const [users] = await connection.query('SELECT * FROM users WHERE email = ?', [requestData.email]);
    expect(users.length).toBe(0);
  });

  test('should clean up registration requests for approved users', async () => {
    // Create a user that is already approved
    const approvedUserEmail = `cleanup.approved.${Date.now()}@example.com`;
    const hashedPassword = await bcrypt.hash('password', 10);
    const [userResult] = await connection.query(
      'INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE)',
      [approvedUserEmail, hashedPassword, 'Cleanup', 'Approved', 2020, 1, true, true]
    );
    const userId = userResult.insertId;

    // Create a registration request for that approved user
    const requestData = {
      email: approvedUserEmail,
      prenom: 'Cleanup',
      nom: 'Approved',
      annee_diplome: 2020,
      section_id: 1,
      message: 'Should be cleaned up.'
    };
    await connection.query(
      'INSERT INTO registration_requests (email, prenom, nom, annee_diplome, section_id, message) VALUES (?, ?, ?, ?, ?, ?)',
      [requestData.email, requestData.prenom, requestData.nom, requestData.annee_diplome, requestData.section_id, requestData.message]
    );

    // Create another request for a non-approved user (should not be cleaned up)
    const unapprovedRequestEmail = `cleanup.unapproved.${Date.now()}@example.com`;
    await connection.query(
      'INSERT INTO registration_requests (email, prenom, nom, annee_diplome, section_id, message) VALUES (?, ?, ?, ?, ?, ?)',
      [unapprovedRequestEmail, 'Cleanup', 'Unapproved', 2021, 1, 'Should not be cleaned up.']
    );

    await User.cleanUpRegistrationRequests(connection);

    // Verify the request for the approved user is deleted
    const [approvedRequests] = await connection.query('SELECT * FROM registration_requests WHERE email = ?', [approvedUserEmail]);
    expect(approvedRequests.length).toBe(0);

    // Verify the request for the unapproved user is still there
    const [unapprovedRequests] = await connection.query('SELECT * FROM registration_requests WHERE email = ?', [unapprovedRequestEmail]);
    expect(unapprovedRequests.length).toBe(1);
  });
});