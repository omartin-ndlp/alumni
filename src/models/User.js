const { getConnection } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async findByEmail(email) {
    const db = getConnection();
    const [rows] = await db.execute(`
      SELECT u.*, s.nom as section_nom 
      FROM users u 
      JOIN sections s ON u.section_id = s.id 
      WHERE u.email = ?
    `, [email]);
    return rows[0];
  }

  static async findById(id) {
    const db = getConnection();
    const [rows] = await db.execute(`
      SELECT u.*, s.nom as section_nom 
      FROM users u 
      JOIN sections s ON u.section_id = s.id 
      WHERE u.id = ?
    `, [id]);
    return rows[0];
  }

  static async create(userData) {
    const db = getConnection();
    const hashedPassword = await bcrypt.hash(userData.password, 12);


console.log('WOULOUWLOULWOULWOU USer');
console.log(userData.email);
console.log(hashedPassword);
console.log(userData.prenom);
console.log(userData.nom);
console.log(userData.annee_diplome);
console.log(userData.section_id);
console.log(db);
    
    const [result] = await db.execute(`
      INSERT INTO users (
        email, password_hash, prenom, nom, annee_diplome, section_id,
        is_approved, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, FALSE, TRUE)
    `, [
      userData.email, hashedPassword, userData.prenom, userData.nom,
      userData.annee_diplome, userData.section_id
    ]);

    return result.insertId;
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static async updateLastLogin(userId) {
    const db = getConnection();
    await db.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [userId]);
  }

  static async getAll(filters = {}) {
    const db = getConnection();
    let query = `
      SELECT u.*, s.nom as section_nom,
             ue.poste as current_position,
             e.nom as current_employer
      FROM users u 
      JOIN sections s ON u.section_id = s.id 
      LEFT JOIN user_employment ue ON u.id = ue.user_id AND ue.is_current = TRUE
      LEFT JOIN employers e ON ue.employer_id = e.id
      WHERE u.is_approved = TRUE AND u.is_active = TRUE
    `;
    
    const params = [];
    
    if (filters.annee_diplome) {
      query += ' AND u.annee_diplome = ?';
      params.push(filters.annee_diplome);
    }
    
    if (filters.section_id) {
      query += ' AND u.section_id = ?';
      params.push(filters.section_id);
    }
    
    if (filters.employer_id) {
      query += ' AND ue.employer_id = ?';
      params.push(filters.employer_id);
    }
    
    if (filters.search) {
      query += ' AND (u.nom LIKE ? OR u.prenom LIKE ? OR e.nom LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (!filters.show_opted_out) {
      query += ' AND u.opt_out_directory = FALSE';
    }
    
    // Tri
    if (filters.sort === 'name') {
      query += ' ORDER BY u.nom, u.prenom';
    } else if (filters.sort === 'year') {
      query += ' ORDER BY u.annee_diplome DESC, u.nom, u.prenom';
    } else if (filters.sort === 'section') {
      query += ' ORDER BY s.nom, u.annee_diplome DESC, u.nom';
    } else if (filters.sort === 'employer') {
      query += ' ORDER BY e.nom, u.nom, u.prenom';
    } else {
      query += ' ORDER BY u.created_at DESC';
    }
    
    const [rows] = await db.execute(query, params);
    return rows;
  }

  static async updateProfile(userId, profileData) {
    const db = getConnection();
    
    const fields = [];
    const values = [];
    
    const allowedFields = [
      'prenom', 'nom', 'profile_picture', 'adresse', 'ville', 'code_postal', 'pays',
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
    
    const [result] = await db.execute(`
      UPDATE users SET ${fields.join(', ')}, updated_at = NOW() 
      WHERE id = ?
    `, values);
    
    return result.affectedRows > 0;
  }

  static async getPendingApprovals() {
    const db = getConnection();
    const [rows] = await db.execute(`
      SELECT rr.*, s.nom as section_nom 
      FROM registration_requests rr
      JOIN sections s ON rr.section_id = s.id
      ORDER BY rr.created_at ASC
    `);
    return rows;
  }

  static async approveRegistration(requestId, approve = true) {
    const db = getConnection();
    
    // Récupérer la demande
    const [requests] = await db.execute(
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
      const hashedPassword = await bcrypt.hash(tempPassword, 12);
      
      await db.execute(`
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
    await db.execute('DELETE FROM registration_requests WHERE id = ?', [requestId]);
    
    return approve;
  }
}

module.exports = User;
