const mysql = require('mysql2/promise');

const createConnection = async () => {
  try {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'ljv_alumni',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'ljv_alumni',
      charset: 'utf8mb4',
      timezone: '+00:00'
    };

    if (!config.password) {
      throw new Error('DB_PASSWORD is not set in environment variables.');
    }
    global.__TEST_DB_POOL__ = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log(`Connexion à la base de données ${process.env.DB_NAME} @ ${process.env.DB_HOST} établie`);
  } catch (error) {
    console.error('Erreur de connexion à la base de données:', error);
    process.exit(1);
  }
};

const getConnection = async () => {
  if (!global.__TEST_DB_POOL__) {
    throw new Error('Base de données non initialisée');
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
  }
};

module.exports = {
  createConnection,
  getConnection,
  closeConnection,
  releaseConnection
};