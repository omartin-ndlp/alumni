const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const createConnection = async () => {
  console.log('--- createConnection() called ---');
  try {
    if (global.__TEST_DB_POOL__) {
      console.log('createConnection(): global.__TEST_DB_POOL__ already exists. Returning existing pool.');
      return global.__TEST_DB_POOL__;
    }

    let dbPassword = process.env.DB_PASSWORD;
    let dbName = process.env.DB_NAME || 'ljv_alumni';
    let dbHost = process.env.DB_HOST || 'localhost';
    let dbPort = process.env.DB_PORT || 3306;
    let dbUser = process.env.DB_USER || 'ljv_alumni';

    if (process.env.NODE_ENV === 'test') {
      console.log('createConnection(): NODE_ENV is test. Attempting to read from .env.test');
      const envTestPath = path.resolve(__dirname, '../../.env.test');
      const envConfig = dotenv.parse(fs.readFileSync(envTestPath));
      dbPassword = envConfig.DB_PASSWORD;
      dbName = envConfig.DB_NAME || dbName;
      dbHost = envConfig.DB_HOST || dbHost;
      dbPort = envConfig.DB_PORT || dbPort;
      dbUser = envConfig.DB_USER || dbUser;
      console.log('createConnection(): DB_PASSWORD read from .env.test:', dbPassword ? '[SET]' : '[UNSET]');
    }

    console.log('createConnection(): Final DB_PASSWORD value:', dbPassword ? '[SET]' : '[UNSET]');

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
      console.error('createConnection(): DB_PASSWORD is not set. Throwing error.');
      throw new Error('DB_PASSWORD is not set.');
    }

    console.log('createConnection(): Creating new database pool...');
    global.__TEST_DB_POOL__ = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    console.log('createConnection(): Database pool created and assigned to global.__TEST_DB_POOL__.');
    return global.__TEST_DB_POOL__;
  } catch (error) {
    console.error('--- Erreur de connexion à la base de données dans createConnection():', error);
    throw error; // Throw error instead of exiting
  }
};

const getConnection = async () => {
  console.log('--- getConnection() called ---');
  if (!global.__TEST_DB_POOL__) {
    console.error('getConnection(): global.__TEST_DB_POOL__ is undefined. Throwing error.');
    throw new Error('Base de données non initialisée. Appelez createConnection() d\'abord.');
  }
  console.log('getConnection(): Getting connection from global.__TEST_DB_POOL__.');
  const connection = await global.__TEST_DB_POOL__.getConnection();
  return connection;
};

const releaseConnection = (connection) => {
  console.log('--- releaseConnection() called ---');
  if (connection) {
    connection.release();
    console.log('releaseConnection(): Connection released.');
  } else {
    console.log('releaseConnection(): No connection to release.');
  }
};

const closeConnection = async () => {
  console.log('--- closeConnection() called ---');
  if (global.__TEST_DB_POOL__) {
    try {
      await global.__TEST_DB_POOL__.end();
      console.log('closeConnection(): Database pool ended.');
    } catch (error) {
      console.error('closeConnection(): Error ending database pool:', error.message);
    } finally {
      global.__TEST_DB_POOL__ = null; // Clear the pool reference regardless of error
      console.log('closeConnection(): global.__TEST_DB_POOL__ cleared.');
    }
  } else {
    console.log('closeConnection(): No global.__TEST_DB_POOL__ to close.');
  }
};

module.exports = {
  createConnection,
  getConnection,
  closeConnection,
  releaseConnection
};