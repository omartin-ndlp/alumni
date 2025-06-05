const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.test' });

// Configuration pour les tests
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'ljv_alumni_test';

// Timeout global pour les tests
jest.setTimeout(30000);

let testConnection;

beforeAll(async () => {
  // Créer la base de données de test
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'ljv_alumni',
    password: process.env.DB_PASSWORD,
    charset: 'utf8mb4'
  };

  testConnection = await mysql.createConnection(config);
  
  await testConnection.execute(`DROP DATABASE IF EXISTS ${process.env.DB_NAME}`);
  await testConnection.execute(`CREATE DATABASE ${process.env.DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  
  await testConnection.end();
  
  // Exécuter les migrations
  const { runMigrations } = require('../scripts/migrate');
  await runMigrations();
});

afterAll(async () => {
  // Nettoyer après les tests
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'ljv_alumni',
    password: process.env.DB_PASSWORD,
    charset: 'utf8mb4'
  };

  testConnection = await mysql.createConnection(config);
  await testConnection.execute(`DROP DATABASE IF EXISTS ${process.env.DB_NAME}`);
  await testConnection.end();
});
