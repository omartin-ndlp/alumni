const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const createConnection = async () => {
  try {
    if (global.__TEST_DB_POOL__) {
      console.log('Using existing database pool (global).');
      return global.__TEST_DB_POOL__;
    }

    let dbPassword = process.env.DB_PASSWORD;
    let dbName = process.env.DB_NAME || 'ljv_alumni';
    let dbHost = process.env.DB_HOST || 'localhost';
    let dbPort = process.env.DB_PORT || 3306;
    let dbUser = process.env.DB_USER || 'ljv_alumni';

    if (process.env.NODE_ENV === 'test') {
      console.log('NODE_ENV is test. Attempting to read from .env.test');
      const envTestPath = path.resolve(__dirname, '../../.env.test');
      const envConfig = dotenv.parse(fs.readFileSync(envTestPath));
      dbPassword = envConfig.DB_PASSWORD;
      dbName = envConfig.DB_NAME || dbName;
      dbHost = envConfig.DB_HOST || dbHost;
      dbPort = envConfig.DB_PORT || dbPort;
      dbUser = envConfig.DB_USER || dbUser;
      console.log('DB_PASSWORD read from .env.test:', dbPassword ? '[SET]' : '[UNSET]');
    }

    console.log('Final DB_PASSWORD value:', dbPassword ? '[SET]' : '[UNSET]');

    const config = {
      host: dbHost,
      port: parseInt(dbPort),
      user: dbUser,
      password: dbPassword,
      database: dbName,
      charset: 'utf8mb4',
      timezone: '+00:00'
    };

    if (!config.password) {
      throw new Error('DB_PASSWORD is not set.');
    }

    global.__TEST_DB_POOL__ = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log(`Connexion à la base de données ${config.database} @ ${config.host} établie`);
    return global.__TEST_DB_POOL__;
  } catch (error) {
    console.error('Erreur de connexion à la base de données:', error);
    throw error; // Throw error instead of exiting
  }
};

const getConnection = async () => {
  if (!global.__TEST_DB_POOL__) {
    throw new Error('Base de données non initialisée. Appelez createConnection() d\'abord.');
  }
  return global.__TEST_DB_POOL__.getConnection(); // Get a connection from the pool
};

const releaseConnection = (connection) => {
  if (connection) {
    connection.release();
  }
};

const closeConnection = async () => {
  if (global.__TEST_DB_POOL__) {
    await global.__TEST_DB_POOL__.end();
    console.log('Connexion à la base de données fermée.');
    global.__TEST_DB_POOL__ = null; // Clear the pool reference
  }
};

module.exports = {
  createConnection,
  getConnection,
  closeConnection,
  releaseConnection
};