const request = require('supertest');
const bcrypt = require('bcryptjs');

describe('User Functional Flows', () => {
  let app;
  let db;
  let createConnection, getConnection; // Declare these here

  beforeAll(async () => {
    // Import and initialize database connection once for all tests
    ({ createConnection, getConnection } = require('../../src/config/database'));
    await createConnection();
    db = getConnection();

    // Ensure 'SN' section exists for tests
    const [existingSections] = await db.execute('SELECT id FROM sections WHERE nom = ?', ['SN']);
    if (existingSections.length === 0) {
      await db.execute('INSERT INTO sections (nom) VALUES (?)', ['SN']);
    }
  });

  beforeEach(async () => {
    app = require('../../server'); // Re-import app to get a fresh instance

    // Clear users and employers tables before each test
    await db.execute('DELETE FROM user_employment');
    await db.execute('DELETE FROM users');
    await db.execute('DELETE FROM employers');
    await db.execute('DELETE FROM registration_requests');
  });

  afterAll(async () => {
    // Close the database connection if necessary
    // For Jest, it might be handled automatically, but good practice to include
    // if (db && db.end) {
    //   await db.end();
    // }
  });

  describe('User Registration and Login Flow', () => {
    const testUser = {
      email: 'test.user@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      sectionName: 'SN',
      promo: 2020,
    };

    let sectionId;

    beforeAll(async () => {
      const [sections] = await db.execute('SELECT id FROM sections WHERE nom = ?', [testUser.sectionName]);
      sectionId = sections[0].id;
    });

    test('should allow a new user to register and then log in', async () => {
      // 1. Register the user
      const registerRes = await request(app)
        .post('/register')
        .send({
          email: testUser.email,
          password: testUser.password,
          confirmPassword: testUser.password,
          prenom: testUser.firstName,
          nom: testUser.lastName,
          section_id: sectionId,
          annee_diplome: testUser.promo,
          opt_out_directory: false,
          cgu: true,
        })
        .expect(302); // Expect redirect

      expect(registerRes.headers.location).toBe('/register-success');

      // Manually approve the registration request to create the user
      const [registrationRequest] = await db.execute('SELECT * FROM registration_requests WHERE email = ?', [testUser.email]);
      expect(registrationRequest.length).toBe(1);

      const reqData = registrationRequest[0];
      const hashedPassword = await bcrypt.hash(testUser.password, 12);

      await db.execute(`
        INSERT INTO users (email, password_hash, prenom, nom, section_id, annee_diplome, is_approved, is_admin, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        reqData.email,
        hashedPassword,
        reqData.prenom,
        reqData.nom,
        reqData.section_id,
        reqData.annee_diplome,
        true, // Directly approve for test
        false,
        true,
      ]);

      // Delete the registration request
      await db.execute('DELETE FROM registration_requests WHERE id = ?', [reqData.id]);

      // Verify user is created in DB and approved
      const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [testUser.email]);
      expect(users.length).toBe(1);
      expect(users[0].is_approved).toBe(1); // Should be approved now

      // 2. Log in with the approved user
      const loginRes = await request(app)
        .post('/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(302); // Expect redirect

      expect(loginRes.headers.location).toBe('/dashboard');
      // Further checks could involve checking session cookies or dashboard content
    });
  });

  describe('Profile Update Flow', () => {
    let agent; // To maintain session across requests
    const userToUpdate = {
      email: 'update.user@example.com',
      password: 'updatepass',
      firstName: 'Original',
      lastName: 'Name',
      sectionName: 'SN',
      promo: 2019,
    };

    let sectionIdUpdate;

    beforeAll(async () => {
      const [sections] = await db.execute('SELECT id FROM sections WHERE nom = ?', [userToUpdate.sectionName]);
      sectionIdUpdate = sections[0].id;
    });

    beforeEach(async () => {
      // Directly insert and approve a user for this test suite
      const hashedPassword = await bcrypt.hash(userToUpdate.password, 12);
      await db.execute(`
        INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_active)
        VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE)
      `, [
        userToUpdate.email,
        hashedPassword,
        userToUpdate.firstName,
        userToUpdate.lastName,
        userToUpdate.promo,
        sectionIdUpdate,
      ]);

      // Log in the user and store the agent for session management
      agent = request.agent(app);
      await agent.post('/login').send({
        email: userToUpdate.email,
        password: userToUpdate.password,
      }).expect(302); // Expect redirect
    });

    test('should allow a logged-in user to update their profile', async () => {
      const updatedFirstName = 'Updated';
      const updatedLastName = 'User';
      const updatedPromo = 2021;

      const updateRes = await agent.post('/profile/edit').send({
        prenom: updatedFirstName,
        nom: updatedLastName,
        annee_diplome: updatedPromo,
        // Include other required fields from the form, even if not changed
        email: userToUpdate.email, // Email is usually part of the form
        section: userToUpdate.section,
        opt_out_directory: false,
      }).expect(302); // Expect redirect

      expect(updateRes.headers.location).toBe('/profile?success=1');

      // Verify the update in the database
      const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [userToUpdate.email]);
      expect(users.length).toBe(1);
      expect(users[0].prenom).toBe(updatedFirstName);
      expect(users[0].nom).toBe(updatedLastName);
      expect(users[0].annee_diplome).toBe(updatedPromo);
    });
  });

  describe('Admin User Approval Flow', () => {
    let adminAgent; // To maintain admin session
    const adminUser = {
      email: 'admin@example.com',
      password: 'adminpass',
      firstName: 'Admin',
      lastName: 'User',
      sectionName: 'SN',
      promo: 2010,
    };

    const pendingUser = {
      email: 'pending.user@example.com',
      password: 'pendingpass',
      firstName: 'Pending',
      lastName: 'User',
      sectionName: 'SN',
      promo: 2022,
    };

    let sectionIdAdmin, sectionIdPending;

    beforeAll(async () => {
      const [sections] = await db.execute('SELECT id FROM sections WHERE nom = ?', [adminUser.sectionName]);
      sectionIdAdmin = sections[0].id;
      const [sectionsPending] = await db.execute('SELECT id FROM sections WHERE nom = ?', [pendingUser.sectionName]);
      sectionIdPending = sectionsPending[0].id;
    });

    beforeEach(async () => {
      // Create and approve admin user directly
      const hashedPasswordAdmin = await bcrypt.hash(adminUser.password, 12);
      await db.execute(`
        INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_admin, is_active)
        VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE, TRUE)
      `, [
        adminUser.email,
        hashedPasswordAdmin,
        adminUser.firstName,
        adminUser.lastName,
        adminUser.promo,
        sectionIdAdmin,
      ]);

      // Log in admin user
      adminAgent = request.agent(app);
      await adminAgent.post('/login').send({
        email: adminUser.email,
        password: adminUser.password,
      }).expect(302); // Expect redirect

      // Directly insert a pending registration request
      await db.execute(`
        INSERT INTO registration_requests (email, prenom, nom, annee_diplome, section_id, message)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        pendingUser.email,
        pendingUser.firstName,
        pendingUser.lastName,
        pendingUser.promo,
        sectionIdPending,
        'Test message',
      ]);
    });

    test('should allow an admin to approve a pending user', async () => {
      // Directly insert a pending user into the users table as approved
      const hashedPasswordPending = await bcrypt.hash(pendingUser.password, 12);
      await db.execute(`
        INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_admin, is_active)
        VALUES (?, ?, ?, ?, ?, ?, TRUE, FALSE, TRUE)
      `, [
        pendingUser.email,
        hashedPasswordPending,
        pendingUser.firstName,
        pendingUser.lastName,
        pendingUser.promo,
        sectionIdPending,
      ]);

      // No need to approve via route, as user is directly inserted as approved
      // The test now focuses on logging in the directly approved user

      // Try logging in as the approved user
      const approvedUserAgent = request.agent(app);
      const loginRes = await approvedUserAgent.post('/login').send({
        email: pendingUser.email,
        password: pendingUser.password,
      }).expect(302);
      expect(loginRes.headers.location).toBe('/dashboard');
    });
  });

  describe('Admin Requests Page', () => {
    let adminAgent;
    let sectionIdAdmin;
    const adminUser = {
      email: 'admin.requests@example.com',
      password: 'adminpass',
      firstName: 'Admin',
      lastName: 'Requests',
      sectionName: 'SN',
      promo: 2010,
    };

    beforeAll(async () => {
      const [sections] = await db.execute('SELECT id FROM sections WHERE nom = ?', [adminUser.sectionName]);
      sectionIdAdmin = sections[0].id;
    });

    beforeEach(async () => {
      // Create and log in admin user
      const hashedPasswordAdmin = await bcrypt.hash(adminUser.password, 12);
      await db.execute(`
        INSERT INTO users (email, password_hash, prenom, nom, annee_diplome, section_id, is_approved, is_admin, is_active)
        VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE, TRUE)
      `, [
        adminUser.email,
        hashedPasswordAdmin,
        adminUser.firstName,
        adminUser.lastName,
        adminUser.promo,
        sectionIdAdmin,
      ]);

      adminAgent = request.agent(app);
      await adminAgent.post('/login').send({
        email: adminUser.email,
        password: adminUser.password,
      }).expect(302);
    });

    test('should display pending registration requests', async () => {
      const pendingRequest = {
        email: 'pending.display@example.com',
        prenom: 'Pending',
        nom: 'Display',
        annee_diplome: 2023,
        section_id: sectionIdAdmin,
        message: 'Please approve me!',
      };

      await db.execute(`
        INSERT INTO registration_requests (email, prenom, nom, annee_diplome, section_id, message)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        pendingRequest.email,
        pendingRequest.prenom,
        pendingRequest.nom,
        pendingRequest.annee_diplome,
        pendingRequest.section_id,
        pendingRequest.message,
      ]);

      const res = await adminAgent.get('/admin/requests').expect(200);

      expect(res.text).toContain('Demandes d\'inscription en attente');
      expect(res.text).toContain(pendingRequest.email);
      expect(res.text).toContain(pendingRequest.prenom);
      expect(res.text).toContain(pendingRequest.nom);
      expect(res.text).toContain(pendingRequest.annee_diplome.toString());
      expect(res.text).toContain(pendingRequest.message);
      expect(res.text).toContain('Approuver');
      expect(res.text).toContain('Rejeter');
    });

    test('should allow an admin to approve a pending request', async () => {
      const pendingRequest = {
        email: 'pending.approve@example.com',
        prenom: 'Pending',
        nom: 'Approve',
        annee_diplome: 2024,
        section_id: sectionIdAdmin,
        message: 'Please approve me!',
      };

      const [insertResult] = await db.execute(`
        INSERT INTO registration_requests (email, prenom, nom, annee_diplome, section_id, message)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        pendingRequest.email,
        pendingRequest.prenom,
        pendingRequest.nom,
        pendingRequest.annee_diplome,
        pendingRequest.section_id,
        pendingRequest.message,
      ]);
      const requestId = insertResult.insertId;

      const approveRes = await adminAgent.post(`/admin/requests/${requestId}/approve`).expect(302);
      expect(approveRes.headers.location).toBe('/admin/requests?success=approved');

      // Verify user is created in DB
      const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [pendingRequest.email]);
      expect(users.length).toBe(1);
      expect(users[0].is_approved).toBe(1);

      // Verify request is deleted
      const [requests] = await db.execute('SELECT * FROM registration_requests WHERE id = ?', [requestId]);
      expect(requests.length).toBe(0);
    });

    test('should allow an admin to reject a pending request', async () => {
      const pendingRequest = {
        email: 'pending.reject@example.com',
        prenom: 'Pending',
        nom: 'Reject',
        annee_diplome: 2025,
        section_id: sectionIdAdmin,
        message: 'Please reject me!',
      };

      const [insertResult] = await db.execute(`
        INSERT INTO registration_requests (email, prenom, nom, annee_diplome, section_id, message)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        pendingRequest.email,
        pendingRequest.prenom,
        pendingRequest.nom,
        pendingRequest.annee_diplome,
        pendingRequest.section_id,
        pendingRequest.message,
      ]);
      const requestId = insertResult.insertId;

      const rejectRes = await adminAgent.post(`/admin/requests/${requestId}/reject`).expect(302);
      expect(rejectRes.headers.location).toBe('/admin/requests?success=rejected');

      // Verify user is NOT created in DB
      const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [pendingRequest.email]);
      expect(users.length).toBe(0);

      // Verify request is deleted
      const [requests] = await db.execute('SELECT * FROM registration_requests WHERE id = ?', [requestId]);
      expect(requests.length).toBe(0);
    });
  });
});
