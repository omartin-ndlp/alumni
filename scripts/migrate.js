const mysql = require('mysql2/promise');
require('dotenv').config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'ljv_alumni',
  password: process.env.DB_PASSWORD,
  charset: 'utf8mb4'
};

async function createDatabase() {
  const dbName = process.env.DB_NAME || 'ljv_alumni';
  console.log(`Attempting to create database: ${dbName}`);
  const connection = await mysql.createConnection(config);
  
  await connection.execute(`CREATE DATABASE IF NOT EXISTS ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  
  await connection.end();
  console.log(`Database ${dbName} created/ensured.`);
}

async function runMigrations() {
  const dbName = process.env.DB_NAME || 'ljv_alumni';
  console.log(`Attempting to run migrations on database: ${dbName}`);
  const connection = await mysql.createConnection({
    ...config,
    database: dbName
  });

  try {
    // Table des sections
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sections (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nom VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    // Table des employeurs
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS employers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nom VARCHAR(255) NOT NULL,
        secteur VARCHAR(100),
        ville VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_nom (nom)
      ) ENGINE=InnoDB
    `);

    // Table des utilisateurs
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        prenom VARCHAR(100) NOT NULL,
        nom VARCHAR(100) NOT NULL,
        annee_diplome YEAR NOT NULL,
        section_id INT NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        is_approved BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        profile_picture VARCHAR(255),
        adresse TEXT,
        ville VARCHAR(100),
        code_postal VARCHAR(10),
        pays VARCHAR(100) DEFAULT 'France',
        telephone VARCHAR(20),
        linkedin VARCHAR(255),
        twitter VARCHAR(255),
        facebook VARCHAR(255),
        site_web VARCHAR(255),
        statut_emploi ENUM('etudiant', 'employe', 'freelance', 'chomeur', 'entrepreneur', 'retraite', 'autre') DEFAULT 'autre',
        opt_out_contact BOOLEAN DEFAULT FALSE,
        opt_out_directory BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL,
        FOREIGN KEY (section_id) REFERENCES sections(id),
        INDEX idx_email (email),
        INDEX idx_annee_diplome (annee_diplome),
        INDEX idx_section (section_id),
        INDEX idx_nom (nom, prenom)
      ) ENGINE=InnoDB
    `);

    // Table des emplois (historique)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_employment (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        employer_id INT NOT NULL,
        poste VARCHAR(255) NOT NULL,
        date_debut DATE,
        date_fin DATE NULL,
        is_current BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (employer_id) REFERENCES employers(id),
        INDEX idx_user (user_id),
        INDEX idx_employer (employer_id),
        INDEX idx_current (is_current)
      ) ENGINE=InnoDB
    `);

    // Table des demandes d'inscription en attente
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS registration_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        prenom VARCHAR(100) NOT NULL,
        nom VARCHAR(100) NOT NULL,
        annee_diplome YEAR NOT NULL,
        section_id INT NOT NULL,
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (section_id) REFERENCES sections(id),
        INDEX idx_email (email),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB
    `);

    // Table des sessions (optionnel, pour stocker en DB)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(128) NOT NULL PRIMARY KEY,
        expires INT UNSIGNED NOT NULL,
        data MEDIUMTEXT,
        INDEX idx_expires (expires)
      ) ENGINE=InnoDB
    `);

    console.log('Toutes les tables ont été créées avec succès');

  } catch (error) {
    console.error('Erreur lors de la création des tables:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

async function main() {
  try {
    console.log('Début de la migration...');
    await createDatabase();
    console.log('Base de données créée');
    await runMigrations();
    console.log('Migration terminée avec succès');
  } catch (error) {
    console.error('Erreur de migration:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runMigrations, main };
