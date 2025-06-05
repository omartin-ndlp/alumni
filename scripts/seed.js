const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'ljv_alumni',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'ljv_alumni',
  charset: 'utf8mb4'
};

async function seedDatabase() {
  const connection = await mysql.createConnection(config);

  try {
    // Ajouter les sections par défaut
    await connection.execute(`
      INSERT INTO sections (nom, description) VALUES 
      ('SN IR', 'Systèmes Numériques - Informatique et Réseaux'),
      ('SN ER', 'Systèmes Numériques - Électronique et Réseaux'),
      ('CIEL IR', 'Cybersécurité, Informatique et réseaux, ÉLectronique - Informatique et Réseaux'),
      ('CIEL ER', 'Cybersécurité, Informatique et réseaux, ÉLectronique - Électronique et Réseaux')
      ON DUPLICATE KEY UPDATE nom = VALUES(nom)
    `);

    // Ajouter quelques employeurs exemple
    await connection.execute(`
      INSERT INTO employers (nom, secteur, ville) VALUES 
      ('Thales', 'Défense et Aéronautique', 'Paris'),
      ('Orange', 'Télécommunications', 'Paris'),
      ('Capgemini', 'Conseil en Technologies', 'Paris'),
      ('Sopra Steria', 'Services Informatiques', 'Paris'),
      ('Atos', 'Services Informatiques', 'Bezons'),
      ('Schneider Electric', 'Industrie', 'Rueil-Malmaison')
      ON DUPLICATE KEY UPDATE nom = VALUES(nom)
    `);

    // Créer un compte administrateur par défaut
    const adminPassword = await bcrypt.hash('admin123', 12);
    const [sections] = await connection.execute('SELECT id FROM sections LIMIT 1');
    
    if (sections.length > 0) {
      await connection.execute(`
        INSERT INTO users (
          email, password_hash, prenom, nom, annee_diplome, section_id, 
          is_admin, is_approved, is_active
        ) VALUES (
          'admin@ljv.fr', ?, 'Admin', 'LJV', 2020, ?, 
          TRUE, TRUE, TRUE
        )
        ON DUPLICATE KEY UPDATE 
          is_admin = TRUE, 
          is_approved = TRUE, 
          is_active = TRUE
      `, [adminPassword, sections[0].id]);
    }

    console.log('✅ Données initiales ajoutées avec succès');
    console.log('📧 Compte admin créé: admin@ljv.fr / admin123');

  } catch (error) {
    console.error('❌ Erreur lors du seed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

async function main() {
  try {
    console.log('🌱 Début du seeding...');
    await seedDatabase();
    console.log('✅ Seeding terminé avec succès');
  } catch (error) {
    console.error('❌ Erreur de seeding:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { seedDatabase };
