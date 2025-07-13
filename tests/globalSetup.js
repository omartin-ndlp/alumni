const dotenv = require('dotenv');
const path = require('path');
const { createConnection } = require('../src/config/database');

module.exports = async () => {
  try {
    dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });
    process.env.NODE_ENV = 'test';

    // Create the global connection pool
    await createConnection();

  } catch (error) {
    console.error('!!!!!! GLOBAL SETUP FAILED !!!!!!');
    console.error(error);
    // Ensure the process exits with an error code to halt Jest
    process.exit(1);
  }
};