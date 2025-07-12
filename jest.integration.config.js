module.exports = {
  testMatch: ['**/tests/integration/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  verbose: true,
  globalSetup: './tests/globalSetup.js',
  globalTeardown: './tests/globalTeardown.js',
};