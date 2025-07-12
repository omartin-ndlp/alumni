module.exports = {
  testMatch: ['**/tests/integration/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFiles: ['./tests/setupIntegrationTests.js'],
  setupFilesAfterEnv: [],
  verbose: true,
  
  globalSetup: './tests/globalSetup.js',
  globalSetup: './tests/globalSetup.js',
  globalTeardown: './tests/globalTeardown.js',
};