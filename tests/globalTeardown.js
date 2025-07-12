const { closeConnection } = require('../src/config/database');

module.exports = async () => {
  await closeConnection();
};