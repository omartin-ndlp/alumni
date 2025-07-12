module.exports = {
  testMatch: ['**/tests/integration/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFilesAfterEnv: [],
  verbose: true,
  
  globalTeardown: './tests/globalTeardown.js',
};