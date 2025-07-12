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

//console.log('YOUHOUHOUHUOHOUH DATABSE')
//console.log(process.env.DB_HOST)
//console.log(process.env.DB_USER)
//console.log(process.env.DB_NAME)



let pool;

const createConnection = async () => {
  try {
    pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    console.log(`Connexion à la base de données ${process.env.DB_NAME} @ ${process.env.DB_HOST}  établie`);
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

const closeConnection = async () => {
  if (pool) {
    await pool.end();
    console.log('Connexion à la base de données fermée.');
  }
};

module.exports = {
  createConnection,
  getConnection,
  closeConnection
};
