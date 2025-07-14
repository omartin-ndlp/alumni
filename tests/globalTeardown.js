const { closeConnection } = require('../src/config/database');

module.exports = async () => {
  console.log('--- GLOBAL TEARDOWN START ---');
  console.log('Global Teardown PID:', process.pid, 'PPID:', process.ppid);
  console.log('Global Teardown - Keys in global:', Object.keys(global));
  await closeConnection();
  console.log('--- GLOBAL TEARDOWN END ---');
};