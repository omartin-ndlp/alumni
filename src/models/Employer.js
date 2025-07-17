const { getConnection, releaseConnection } = require('../config/database');

class Employer {
  static async findByName(name, dbConnection = null) {
    let connection = dbConnection;
    try {
      if (!connection) {
        connection = await getConnection();
      }
      const [rows] = await connection.execute(
        'SELECT * FROM employers WHERE nom = ?',
        [name]
      );
      return rows[0];
    } finally {
      if (!dbConnection) {
        releaseConnection(connection);
      }
    }
  }

  static async search(query, limit = 10, dbConnection = null) {
    let connection = dbConnection;
    try {
      if (!connection) {
        connection = await getConnection();
      }
      const [rows] = await connection.execute(`
        SELECT * FROM employers 
        WHERE nom LIKE ? 
        ORDER BY nom 
        LIMIT ?
      `, [`%${query}%`, limit]);
      return rows;
    } finally {
      if (!dbConnection) {
        releaseConnection(connection);
      }
    }
  }

  static async create(employerData, dbConnection = null) {
    let connection = dbConnection;
    try {
      if (!connection) {
        connection = await getConnection();
      }
      const [result] = await connection.execute(`
        INSERT INTO employers (nom, secteur, ville)
        VALUES (?, ?, ?)
      `, [employerData.nom, employerData.secteur || null, employerData.ville || null]);

      return { id: result.insertId, ...employerData };
    } finally {
      if (!dbConnection) {
        releaseConnection(connection);
      }
    }
  }

  static async findOrCreate(name, additionalData = {}, dbConnection = null) {
    let employer = await this.findByName(name, dbConnection);

    if (!employer) {
      const createdEmployer = await this.create({
        nom: name,
        ...additionalData
      }, dbConnection);
      employer = await this.findById(createdEmployer.id, dbConnection);
    }

    return employer;
  }

  static async findById(id, dbConnection = null) {
    let connection = dbConnection;
    try {
      if (!connection) {
        connection = await getConnection();
      }
      const [rows] = await connection.execute('SELECT * FROM employers WHERE id = ?', [id]);
      return rows[0];
    } finally {
      if (!dbConnection) {
        releaseConnection(connection);
      }
    }
  }

  static async update(id, employerData, dbConnection = null) {
    let connection = dbConnection;
    try {
      if (!connection) {
        connection = await getConnection();
      }
      const fields = [];
      const values = [];

      if (employerData.nom !== undefined) { fields.push('nom = ?'); values.push(employerData.nom); }
      if (employerData.secteur !== undefined) { fields.push('secteur = ?'); values.push(employerData.secteur); }
      if (employerData.ville !== undefined) { fields.push('ville = ?'); values.push(employerData.ville); }

      if (fields.length === 0) {
        return false; // Nothing to update
      }

      values.push(id);

      const [result] = await connection.execute(`
        UPDATE employers SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = ?
      `, values);

      return result.affectedRows > 0;
    } finally {
      if (!dbConnection) {
        releaseConnection(connection);
      }
    }
  }

  static async delete(id, dbConnection = null) {
    let connection = dbConnection;
    try {
      if (!connection) {
        connection = await getConnection();
      }
      const [result] = await connection.execute('DELETE FROM employers WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } finally {
      if (!dbConnection) {
        releaseConnection(connection);
      }
    }
  }

  static async getWithEmployeeCount(dbConnection = null) {
    let connection = dbConnection;
    try {
      if (!connection) {
        connection = await getConnection();
      }
      const [rows] = await connection.execute(`
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
    } finally {
      if (!dbConnection) {
        releaseConnection(connection);
      }
    }
  }

  static async getEmployees(employerId, dbConnection = null) {
    let connection = dbConnection;
    try {
      if (!connection) {
        connection = await getConnection();
      }
      const [rows] = await connection.execute(`
        WITH RankedEmployment AS (
          SELECT 
            ue.id as employment_id, ue.user_id, ue.employer_id, ue.poste, ue.date_debut, ue.date_fin, ue.is_current,
            u.id as user_id_from_users, u.prenom, u.nom, u.email, u.annee_diplome, u.profile_picture, u.opt_out_contact,
            s.nom as section_nom,
            ROW_NUMBER() OVER(PARTITION BY ue.user_id ORDER BY ue.is_current DESC, ue.date_debut DESC) as rn
          FROM user_employment ue
          JOIN users u ON ue.user_id = u.id
          JOIN sections s ON u.section_id = s.id
          WHERE ue.employer_id = ? AND u.is_approved = TRUE AND u.is_active = TRUE AND u.opt_out_directory = FALSE
        )
        SELECT * FROM RankedEmployment WHERE rn = 1 ORDER BY date_debut DESC
      `, [employerId]);
      return rows;
    } finally {
      if (!dbConnection) {
        releaseConnection(connection);
      }
    }
  }
}

module.exports = Employer;