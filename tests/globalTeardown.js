const { closeConnection } = require('../src/config/database');

module.exports = async () => {
  console.log('Global Teardown: Closing database connection pool...');
  await closeConnection();
  console.log('Global Teardown: Database connection pool closed.');
};