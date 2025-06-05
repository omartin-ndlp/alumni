const { getConnection } = require('../config/database');

class Employer {
  static async findByName(name) {
    const db = getConnection();
    const [rows] = await db.execute(
      'SELECT * FROM employers WHERE nom = ?',
      [name]
    );
    return rows[0];
  }

  static async search(query, limit = 10) {
    const db = getConnection();
    const [rows] = await db.execute(`
      SELECT * FROM employers 
      WHERE nom LIKE ? 
      ORDER BY nom 
      LIMIT ?
    `, [`%${query}%`, limit]);
    return rows;
  }

  static async create(employerData) {
    const db = getConnection();
    const [result] = await db.execute(`
      INSERT INTO employers (nom, secteur, ville)
      VALUES (?, ?, ?)
    `, [employerData.nom, employerData.secteur || null, employerData.ville || null]);
    
    return result.insertId;
  }

  static async findOrCreate(name, additionalData = {}) {
    let employer = await this.findByName(name);
    
    if (!employer) {
      const employerId = await this.create({
        nom: name,
        ...additionalData
      });
      employer = await this.findById(employerId);
    }
    
    return employer;
  }

  static async findById(id) {
    const db = getConnection();
    const [rows] = await db.execute('SELECT * FROM employers WHERE id = ?', [id]);
    return rows[0];
  }

  static async getWithEmployeeCount() {
    const db = getConnection();
    const [rows] = await db.execute(`
      SELECT e.*, COUNT(ue.id) as employee_count,
             COUNT(CASE WHEN ue.is_current = TRUE THEN 1 END) as current_employee_count
      FROM employers e
      LEFT JOIN user_employment ue ON e.id = ue.employer_id
      LEFT JOIN users u ON ue.user_id = u.id AND u.is_approved = TRUE AND u.is_active = TRUE
      GROUP BY e.id
      HAVING employee_count > 0
      ORDER BY current_employee_count DESC, employee_count DESC, e.nom
    `);
    return rows;
  }

  static async getEmployees(employerId) {
    const db = getConnection();
    const [rows] = await db.execute(`
      SELECT u.*, ue.poste, ue.date_debut, ue.date_fin, ue.is_current,
             s.nom as section_nom
      FROM user_employment ue
      JOIN users u ON ue.user_id = u.id
      JOIN sections s ON u.section_id = s.id
      WHERE ue.employer_id = ? AND u.is_approved = TRUE AND u.is_active = TRUE
      AND u.opt_out_directory = FALSE
      ORDER BY ue.is_current DESC, ue.date_debut DESC
    `, [employerId]);
    return rows;
  }
}

module.exports = Employer;
