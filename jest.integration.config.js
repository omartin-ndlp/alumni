module.exports = {
  testMatch: ['**/tests/integration/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFiles: ['./tests/setupIntegrationTests.js'],
  setupFilesAfterEnv: [],
  verbose: true,
  
  globalTeardown: './tests/globalTeardown.js',
};