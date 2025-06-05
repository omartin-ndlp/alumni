const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'ljv_alumni',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'ljv_alumni',
  charset: 'utf8mb4',
  timezone: '+00:00'
};

let pool;

const createConnection = async () => {
  try {
    pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      acquireTimeout: 60000,
      timeout: 60000
    });
    
    console.log('Connexion à la base de données établie');
    return pool;
  } catch (error) {
    console.error('Erreur de connexion à la base de données:', error);
    process.exit(1);
  }
};

const getConnection = () => {
  if (!pool) {
    throw new Error('Base de données non initialisée');
  }
  return pool;
};

module.exports = {
  createConnection,
  getConnection
};
