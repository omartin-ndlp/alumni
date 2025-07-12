const { getConnection, releaseConnection } = require('../../src/config/database');
const Employer = require('../../src/models/Employer');

describe('Employer Model Database Interactions', () => {
  let connection;

  beforeEach(async () => {
    connection = await getConnection();
    await connection.beginTransaction();
  });

  afterEach(async () => {
    await connection.rollback();
    releaseConnection(connection);
  });

  test('should create a new employer', async () => {
    const employerData = {
      nom: `Test Employer ${Date.now()}`,
      secteur: 'IT',
      ville: 'Paris'
    };
    const createdEmployer = await Employer.create(employerData, connection);
    expect(createdEmployer).toHaveProperty('id');
    expect(createdEmployer.nom).toBe(employerData.nom);

    const [rows] = await connection.query('SELECT * FROM employers WHERE id = ?', [createdEmployer.id]);
    expect(rows.length).toBe(1);
    expect(rows[0].nom).toBe(employerData.nom);
  });

  test('should retrieve an employer by ID', async () => {
    const employerData = {
      nom: `FindById Employer ${Date.now()}`,
      secteur: 'Finance',
      ville: 'London'
    };
    const createdEmployer = await Employer.create(employerData, connection);

    const foundEmployer = await Employer.findById(createdEmployer.id, connection);
    expect(foundEmployer).not.toBeNull();
    expect(foundEmployer.nom).toBe(employerData.nom);
  });

  test('should retrieve an employer by name', async () => {
    const employerData = {
      nom: `FindByName Employer ${Date.now()}`,
      secteur: 'Retail',
      ville: 'Berlin'
    };
    const createdEmployer = await Employer.create(employerData, connection);

    const foundEmployer = await Employer.findByName(employerData.nom, connection);
    expect(foundEmployer).not.toBeNull();
    expect(foundEmployer.id).toBe(createdEmployer.id);
  });

  test('should update an existing employer', async () => {
    const employerData = {
      nom: `Update Employer ${Date.now()}`,
      secteur: 'Manufacturing',
      ville: 'Tokyo'
    };
    const createdEmployer = await Employer.create(employerData, connection);

    const updatedName = `Updated Employer ${Date.now()}`;
    const isUpdated = await Employer.update(createdEmployer.id, { nom: updatedName, ville: 'Kyoto' }, connection);
    expect(isUpdated).toBe(true);

    const [rows] = await connection.query('SELECT * FROM employers WHERE id = ?', [createdEmployer.id]);
    expect(rows.length).toBe(1);
    expect(rows[0].nom).toBe(updatedName);
    expect(rows[0].ville).toBe('Kyoto');
    expect(rows[0].secteur).toBe(employerData.secteur); // Should remain unchanged
  });

  test('should delete an employer', async () => {
    const employerData = {
      nom: `Delete Employer ${Date.now()}`,
      secteur: 'Healthcare',
      ville: 'New York'
    };
    const createdEmployer = await Employer.create(employerData, connection);

    const isDeleted = await Employer.delete(createdEmployer.id, connection);
    expect(isDeleted).toBe(true);

    const [rows] = await connection.query('SELECT * FROM employers WHERE id = ?', [createdEmployer.id]);
    expect(rows.length).toBe(0);
  });
});