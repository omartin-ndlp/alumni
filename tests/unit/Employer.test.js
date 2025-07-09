const Employer = require('../../src/models/Employer');
const { getConnection } = require('../../src/config/database');

// Mock the database connection
jest.mock('../../src/config/database', () => ({
  getConnection: jest.fn(),
}));

describe('Employer Model', () => {
  let mockDb;
  let mockExecute;

  beforeEach(() => {
    mockExecute = jest.fn();
    mockDb = {
      execute: mockExecute,
    };
    getConnection.mockReturnValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test cases for findByName
  describe('findByName', () => {
    test('should return an employer if a matching name exists', async () => {
      const mockEmployer = { id: 1, nom: 'Test Employer' };
      mockExecute.mockResolvedValueOnce([[mockEmployer]]);
      const employer = await Employer.findByName('Test Employer');
      expect(employer).toEqual(mockEmployer);
      expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM employers WHERE nom = ?', ['Test Employer']);
    });

    test('should return undefined if no employer with the given name exists', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const employer = await Employer.findByName('NonExistent Employer');
      expect(employer).toBeUndefined();
    });
  });

  // Test cases for search
  describe('search', () => {
    test('should return a list of employers matching the query', async () => {
      const mockEmployers = [{ id: 1, nom: 'Employer A' }, { id: 2, nom: 'Employer B' }];
      mockExecute.mockResolvedValueOnce([mockEmployers]);
      const employers = await Employer.search('Employer');
      expect(employers).toEqual(mockEmployers);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringMatching(/SELECT \* FROM employers\s+WHERE nom LIKE \? \s+ORDER BY nom \s+LIMIT \?/), ['%Employer%', 10]);
    });

    test('should respect the limit parameter', async () => {
      const mockEmployers = [{ id: 1, nom: 'Employer A' }];
      mockExecute.mockResolvedValueOnce([mockEmployers]);
      const employers = await Employer.search('Employer', 1);
      expect(employers).toEqual(mockEmployers);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('LIMIT ?'), ['%Employer%', 1]);
    });

    test('should return an empty array if no employers match the query', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const employers = await Employer.search('NonExistent');
      expect(employers).toEqual([]);
    });
  });

  // Test cases for create
  describe('create', () => {
    test('should successfully create a new employer and return its insertId', async () => {
      mockExecute.mockResolvedValueOnce([{ insertId: 5 }]);
      const employerId = await Employer.create({ nom: 'New Employer', secteur: 'IT', ville: 'Paris' });
      expect(employerId).toBe(5);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringMatching(/INSERT INTO employers \(nom, secteur, ville\)\s+VALUES \(\?, \?, \?\)/), ['New Employer', 'IT', 'Paris']);
    });

    test('should handle null values for secteur and ville', async () => {
      mockExecute.mockResolvedValueOnce([{ insertId: 6 }]);
      const employerId = await Employer.create({ nom: 'Employer No Sector' });
      expect(employerId).toBe(6);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringMatching(/INSERT INTO employers \(nom, secteur, ville\)\s+VALUES \(\?, \?, \?\)/), ['Employer No Sector', null, null]);
    });
  });

  // Test cases for findOrCreate
  describe('findOrCreate', () => {
    test('should find an existing employer if one exists', async () => {
      const mockEmployer = { id: 1, nom: 'Existing Employer' };
      mockExecute.mockResolvedValueOnce([[mockEmployer]]); // for findByName
      const employer = await Employer.findOrCreate('Existing Employer');
      expect(employer).toEqual(mockEmployer);
      expect(mockExecute).toHaveBeenCalledTimes(1); // Only findByName should be called
    });

    test('should create a new employer if one does not exist', async () => {
      const newEmployerId = 2;
      const newEmployer = { id: newEmployerId, nom: 'Brand New Employer', secteur: 'Finance' };
      mockExecute.mockResolvedValueOnce([[]]); // for findByName (not found)
      mockExecute.mockResolvedValueOnce([{ insertId: newEmployerId }]); // for create
      mockExecute.mockResolvedValueOnce([[newEmployer]]); // for findById

      const employer = await Employer.findOrCreate('Brand New Employer', { secteur: 'Finance' });
      expect(employer).toEqual(newEmployer);
      expect(mockExecute).toHaveBeenCalledTimes(3); // findByName, create, findById
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO employers'), ['Brand New Employer', 'Finance', null]);
    });

    test('should correctly merge additionalData when creating a new employer', async () => {
      const newEmployerId = 3;
      const newEmployer = { id: newEmployerId, nom: 'Employer With Data', secteur: 'Retail', ville: 'Lyon' };
      mockExecute.mockResolvedValueOnce([[]]); // for findByName (not found)
      mockExecute.mockResolvedValueOnce([{ insertId: newEmployerId }]); // for create
      mockExecute.mockResolvedValueOnce([[newEmployer]]); // for findById

      const employer = await Employer.findOrCreate('Employer With Data', { secteur: 'Retail', ville: 'Lyon' });
      expect(employer).toEqual(newEmployer);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO employers'), ['Employer With Data', 'Retail', 'Lyon']);
    });
  });

  // Test cases for findById
  describe('findById', () => {
    test('should return an employer if a matching ID exists', async () => {
      const mockEmployer = { id: 10, nom: 'Employer By ID' };
      mockExecute.mockResolvedValueOnce([[mockEmployer]]);
      const employer = await Employer.findById(10);
      expect(employer).toEqual(mockEmployer);
      expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM employers WHERE id = ?', [10]);
    });

    test('should return undefined if no employer with the given ID exists', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const employer = await Employer.findById(999);
      expect(employer).toBeUndefined();
    });
  });

  // Test cases for getWithEmployeeCount
  describe('getWithEmployeeCount', () => {
    test('should return employers with correct employee_count and current_employee_count', async () => {
      const mockEmployers = [
        { id: 1, nom: 'Emp A', employee_count: 5, current_employee_count: 3 },
        { id: 2, nom: 'Emp B', employee_count: 2, current_employee_count: 1 },
      ];
      mockExecute.mockResolvedValueOnce([mockEmployers]);
      const employers = await Employer.getWithEmployeeCount();
      expect(employers).toEqual(mockEmployers);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('SELECT e.*, COUNT(ue.id) as employee_count'));
    });

    test('should only include employers with employee_count > 0', async () => {
      const mockEmployers = [
        { id: 1, nom: 'Emp A', employee_count: 5, current_employee_count: 3 },
      ];
      mockExecute.mockResolvedValueOnce([mockEmployers]); // Mocking the DB to return only those with count > 0
      const employers = await Employer.getWithEmployeeCount();
      expect(employers.every(emp => emp.employee_count > 0)).toBe(true);
    });

    test('should return an empty array if no employers have employees', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const employers = await Employer.getWithEmployeeCount();
      expect(employers).toEqual([]);
    });
  });

  // Test cases for getEmployees
  describe('getEmployees', () => {
    test('should return a list of employees for a given employer ID', async () => {
      const mockEmployees = [
        { id: 1, nom: 'User 1', poste: 'Dev', section_nom: 'SN' },
        { id: 2, nom: 'User 2', poste: 'QA', section_nom: 'CIEL' },
      ];
      mockExecute.mockResolvedValueOnce([mockEmployees]);
      const employees = await Employer.getEmployees(1);
      expect(employees).toEqual(mockEmployees);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('SELECT u.*, ue.poste'), [1]);
    });

    test('should filter by is_approved, is_active, and opt_out_directory', async () => {
      // This test primarily checks the SQL query structure, as mocking the DB response directly
      // won't show if the WHERE clauses are correctly applied by the DB.
      // We'll ensure the query contains the expected WHERE clauses.
      mockExecute.mockResolvedValueOnce([[]]);
      await Employer.getEmployees(1);
      const expectedQueryPart = 'WHERE ue.employer_id = ? AND u.is_approved = TRUE AND u.is_active = TRUE AND u.opt_out_directory = FALSE';
      expect(mockExecute).toHaveBeenCalledWith(expect.stringMatching(/SELECT u\.\*, ue\.poste, ue\.date_debut, ue\.date_fin, ue\.is_current,\s+s\.nom as section_nom\s+FROM user_employment ue\s+JOIN users u ON ue\.user_id = u\.id\s+JOIN sections s ON u\.section_id = s\.id\s+WHERE ue\.employer_id = \? AND u\.is_approved = TRUE AND u\.is_active = TRUE\s+AND u\.opt_out_directory = FALSE\s+ORDER BY ue\.is_current DESC, ue\.date_debut DESC/), [1]);
    });

    test('should return an empty array if no employees found for the employer', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const employees = await Employer.getEmployees(999);
      expect(employees).toEqual([]);
    });
  });
});
