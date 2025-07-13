const { getConnection, releaseConnection } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async findByEmail(email, dbConnection = null) {
    let connection = dbConnection;
    try {
      if (!connection) {
        connection = await getConnection();
      }
      const [rows] = await connection.execute(`
        SELECT u.*, s.nom as section_nom 
        FROM users u 
        JOIN sections s ON u.section_id = s.id 
        WHERE u.email = ?
      `, [email]);
      return rows[0];
    } finally {
      if (!dbConnection) { // Only release if we got the connection ourselves
        releaseConnection(connection);
      }
    }
  }

  static async findById(id, dbConnection = null) {
    let connection = dbConnection;
    try {
      if (!connection) {
        connection = await getConnection();
      }
      const [rows] = await connection.execute(`
        SELECT 
          u.id, u.email, u.password_hash, u.prenom, u.nom, u.annee_diplome, u.section_id,
          u.is_admin, u.is_approved, u.is_active, u.profile_picture, u.adresse, u.ville,
          u.code_postal, u.pays, u.telephone, u.linkedin, u.twitter, u.facebook, u.site_web,
          u.statut_emploi, u.opt_out_contact, u.opt_out_directory, u.created_at, u.updated_at, u.last_login,
          s.nom as section_nom 
        FROM users u 
        JOIN sections s ON u.section_id = s.id 
        WHERE u.id = ?
      `, [id]);
      return rows[0];
    } finally {
      if (!dbConnection) { // Only release if we got the connection ourselves
        releaseConnection(connection);
      }
    }
  }

  static async create(userData, dbConnection = null) {
    let connection = dbConnection;
    try {
      if (!connection) {
        connection = await getConnection();
      }
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      const [result] = await connection.execute(`
        INSERT INTO users (
          email, password_hash, prenom, nom, annee_diplome, section_id,
          is_approved, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, FALSE, TRUE)
      `, [
        userData.email, hashedPassword, userData.prenom, userData.nom,
        userData.annee_diplome, userData.section_id
      ]);

      return { id: result.insertId, ...userData }; // Return created user data including ID
    } finally {
      if (!dbConnection) { // Only release if we got the connection ourselves
        releaseConnection(connection);
      }
    }
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static async updateLastLogin(userId, dbConnection = null) {
    let connection = dbConnection;
    try {
      if (!connection) {
        connection = await getConnection();
      }
      await connection.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [userId]);
    } finally {
      if (!dbConnection) {
        releaseConnection(connection);
      }
    }
  }

  static async getAll(filters = {}, dbConnection = null) {
    let connection = dbConnection;
    try {
      if (!connection) {
        connection = await getConnection();
      }

      const {
        annee_diplome,
        section_id,
        employer_id,
        search,
        sortBy,
        limit,
        offset,
        show_opted_out = false,
        show_admins = false,
      } = filters;

      const params = [];
      let whereClauses = ['u.is_approved = TRUE', 'u.is_active = TRUE'];

      if (annee_diplome) {
        whereClauses.push('u.annee_diplome = ?');
        params.push(annee_diplome);
      }
      if (section_id) {
        whereClauses.push('u.section_id = ?');
        params.push(section_id);
      }
      if (employer_id) {
        whereClauses.push('ue.employer_id = ?');
        params.push(employer_id);
      }
      if (search) {
        whereClauses.push('(u.nom LIKE ? OR u.prenom LIKE ? OR u.email LIKE ? OR e.nom LIKE ?)');
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }
      if (!show_opted_out) {
        whereClauses.push('u.opt_out_directory = FALSE');
      }
      if (!show_admins) {
        whereClauses.push('u.is_admin = FALSE');
      }

      const fromAndJoins = `
        FROM users u
        JOIN sections s ON u.section_id = s.id
        LEFT JOIN user_employment ue ON u.id = ue.user_id AND ue.is_current = TRUE
        LEFT JOIN employers e ON ue.employer_id = e.id
      `;
      const whereQuery = `WHERE ${whereClauses.join(' AND ')}`;

      const countQuery = `SELECT COUNT(DISTINCT u.id) as total ${fromAndJoins} ${whereQuery}`;
      const [countRows] = await connection.execute(countQuery, params);
      const total = countRows[0].total;

      let orderByClause = 'ORDER BY u.created_at DESC';
      if (sortBy === 'name') {
        orderByClause = 'ORDER BY u.nom ASC, u.prenom ASC';
      } else if (sortBy === 'year') {
        orderByClause = 'ORDER BY u.annee_diplome DESC, u.nom ASC, u.prenom ASC';
      } else if (sortBy === 'section') {
        orderByClause = 'ORDER BY s.nom ASC, u.annee_diplome DESC, u.nom ASC';
      } else if (sortBy === 'employer') {
        orderByClause = 'ORDER BY e.nom ASC, u.nom ASC, u.prenom ASC';
      } else if (sortBy === 'created_at') {
        orderByClause = 'ORDER BY u.created_at DESC';
      }

      const limitClause = (limit !== undefined && offset !== undefined) ? 'LIMIT ? OFFSET ?' : '';
      const limitParams = (limit !== undefined && offset !== undefined) ? [limit, offset] : [];

      const dataQuery = `
        SELECT
          u.id, u.email, u.prenom, u.nom, u.annee_diplome, u.created_at,
          s.id as section_id, s.nom as section_nom,
          e.id as employer_id, e.nom as employer_nom,
          ue.poste as current_poste
        ${fromAndJoins}
        ${whereQuery}
        ${orderByClause}
        ${limitClause}
      `;

      const [users] = await connection.execute(dataQuery, [...params, ...limitParams]);
      return { users, total };

    } finally {
      if (!dbConnection) {
        releaseConnection(connection);
      }
    }
  }

  static async updateProfile(userId, profileData, dbConnection = null) {
    let connection = dbConnection;
    try {
      if (!connection) {
        connection = await getConnection();
      }
      
      const fields = [];
      const values = [];
      
      const allowedFields = [
        'prenom', 'nom', 'annee_diplome', 'profile_picture', 'adresse', 'ville', 'code_postal', 'pays',
        'telephone', 'linkedin', 'twitter', 'facebook', 'site_web', 'statut_emploi',
        'opt_out_contact', 'opt_out_directory'
      ];
      
      for (const [key, value] of Object.entries(profileData)) {
        if (allowedFields.includes(key) && value !== undefined) {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }
      
      if (fields.length === 0) {
        throw new Error('Aucune donnée valide à mettre à jour');
      }
      
      values.push(userId);
      
      const [result] = await connection.execute(`
        UPDATE users SET ${fields.join(', ')}, updated_at = NOW() 
        WHERE id = ?
      `, values);
      
      return result.affectedRows > 0;
    } finally {
      if (!dbConnection) {
        releaseConnection(connection);
      }
    }
  }

  static async getPendingApprovals(dbConnection = null) {
    let connection = dbConnection;
    try {
      if (!connection) {
        connection = await getConnection();
      }
      const [rows] = await connection.execute(`
        SELECT rr.*, s.nom as section_nom 
        FROM registration_requests rr
        JOIN sections s ON rr.section_id = s.id
        ORDER BY rr.created_at ASC
      `);
      return rows;
    } finally {
      if (!dbConnection) {
        releaseConnection(connection);
      }
    }
  }

  static async approveRegistration(requestId, approve = true, dbConnection = null) {
    let connection = dbConnection;
    try {
      if (!connection) {
        connection = await getConnection();
      }
      
      // Récupérer la demande
      const [requests] = await connection.execute(
        'SELECT * FROM registration_requests WHERE id = ?', 
        [requestId]
      );
      
      if (requests.length === 0) {
        throw new Error('Demande d\'inscription non trouvée');
      }
      
      const request = requests[0];
      
      if (approve) {
        // Créer le compte utilisateur
        const tempPassword = Math.random().toString(36).slice(-12);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        
        await connection.execute(`
          INSERT INTO users (
            email, password_hash, prenom, nom, annee_diplome, section_id,
            is_approved, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE)
        `, [
          request.email, hashedPassword, request.prenom, request.nom,
          request.annee_diplome, request.section_id
        ]);
        
        // TODO: Envoyer email avec mot de passe temporaire
      }
      
      // Supprimer la demande
      await connection.execute('DELETE FROM registration_requests WHERE id = ?', [requestId]);
      
      return approve;
    } finally {
      if (!dbConnection) {
        releaseConnection(connection);
      }
    }
  }

  static async cleanUpRegistrationRequests(dbConnection = null) {
    let connection = dbConnection;
    try {
      if (!connection) {
        connection = await getConnection();
      }
      // Find registration requests for which a user already exists and is approved
      await connection.execute(`
        DELETE rr FROM registration_requests rr
        JOIN users u ON rr.email = u.email
        WHERE u.is_approved = TRUE
      `);
    } finally {
      if (!dbConnection) {
        releaseConnection(connection);
      }
    }
  }
}

module.exports = User;