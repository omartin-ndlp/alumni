
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

async function seed() {
  const connection = await mysql.createConnection(config);

  try {
    // Seed sections
    await connection.execute('INSERT IGNORE INTO sections (id, nom, description) VALUES (1, \'SN\', \'Systèmes Numériques\')');
    await connection.execute('INSERT IGNORE INTO sections (id, nom, description) VALUES (2, \'CIEL\', \'Cybersécurité, Informatique et réseaux, Électronique\')');

    // Seed users
    const salt = await bcrypt.genSalt(12);
    const adminPassword = await bcrypt.hash('admin123', salt);
    const userPassword = await bcrypt.hash('password', salt);
    await connection.execute(`
      INSERT IGNORE INTO users (id, nom, prenom, email, password_hash, annee_diplome, section_id, is_approved, is_active, is_admin)
      VALUES (1, 'Admin', 'User', 'admin@ljv.fr', ?, 2023, 1, TRUE, TRUE, TRUE)
    `, [adminPassword]);
    await connection.execute(`
      INSERT IGNORE INTO users (id, nom, prenom, email, password_hash, annee_diplome, section_id, is_approved, is_active, is_admin)
      VALUES (2, 'Test', 'User', 'test@example.com', ?, 2023, 1, TRUE, TRUE, FALSE)
    `, [userPassword]);

    console.log('✅ Database seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
