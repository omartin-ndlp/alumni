const dotenv = require('dotenv');
const path = require('path');

// Load .env.test if NODE_ENV is 'test'
if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });
} else {
  dotenv.config();
}
const mysql = require('mysql2/promise');
const fs = require('fs');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'ljv_alumni',
  password: process.env.DB_PASSWORD,
  charset: 'utf8mb4'
};

if (!config.password) {
  console.error('Error: DB_PASSWORD is not set in your .env file.');
  process.exit(1);
}

console.log(`DB_PASSWORD: ${process.env.DB_PASSWORD ? '*****' : 'NOT SET'}`);

async function createDatabase() {
  const dbName = process.env.DB_NAME || 'ljv_alumni';
  console.log(`Attempting to create database: ${dbName}`);
  const connection = await mysql.createConnection(config);

  await connection.execute(`CREATE DATABASE IF NOT EXISTS ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

  await connection.end();
  console.log(`Database ${dbName} created/ensured.`);
}

async function dropDatabase() {
  const dbName = process.env.DB_NAME || 'ljv_alumni';
  console.log(`Attempting to drop database: ${dbName}`);
  const connection = await mysql.createConnection(config);

  await connection.execute(`DROP DATABASE IF EXISTS ${dbName}`);

  await connection.end();
  console.log(`Database ${dbName} dropped.`);
}

async function runMigrations() {
  const dbName = process.env.DB_NAME || 'ljv_alumni';
  console.log(`Attempting to run migrations on database: ${dbName}`);
  const connection = await mysql.createConnection({
    ...config,
    database: dbName
  });

  try {
    // Create migrations table if it doesn't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort(); // Ensure migrations are run in order

    for (const file of migrationFiles) {
      const migrationName = file;
      const [rows] = await connection.execute(
        'SELECT id FROM migrations WHERE name = ?',
        [migrationName]
      );

      if (rows.length === 0) {
        console.log(`Applying migration: ${migrationName}`);
        const migration = require(path.join(migrationsDir, file));
        await migration.up(connection);
        await connection.execute(
          'INSERT INTO migrations (name) VALUES (?)',
          [migrationName]
        );
        console.log(`Migration ${migrationName} applied successfully.`);
      } else {
        console.log(`Migration ${migrationName} already applied. Skipping.`);
      }
    }

    console.log('All migrations processed.');

  } catch (error) {
    console.error('Error during migration process:', error);
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
    throw error;
  }
}

async function seedCommonData() {
  const dbName = process.env.DB_NAME || 'ljv_alumni';
  console.log(`Seeding common data into database: ${dbName}`);
  const connection = await mysql.createConnection({
    ...config,
    database: dbName
  });

  try {
    await connection.query('INSERT INTO sections (id, nom, description) VALUES (1, \'SN IR\', \'Systèmes Numériques - Informatique et Réseaux\'), (2, \'SN ER\', \'Systèmes Numériques - Électronique et Réseaux\'), (3, \'CIEL IR\', \'Cybersécurité, Informatique et réseaux, ÉLectronique - Informatique et Réseaux\') ON DUPLICATE KEY UPDATE nom=VALUES(nom), description=VALUES(description)');
    await connection.query('INSERT INTO employers (id, nom) VALUES (1, \'Google\'), (2, \'Microsoft\'), (3, \'Apple\') ON DUPLICATE KEY UPDATE nom=VALUES(nom)');
    console.log('Common data seeded successfully.');
  } catch (error) {
    console.error('Error seeding common data:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { runMigrations: main, main, dropDatabase, seedCommonData };