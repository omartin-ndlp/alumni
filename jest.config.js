module.exports = {
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/integration/**/*.test.js',
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  verbose: true,
  setupFilesAfterEnv: ['./tests/setupEachTestFile.js', './tests/setupIntegrationTests.js'],
};