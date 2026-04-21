export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  setupFiles: ['<rootDir>/tests/config/setupEnv.js'],
  collectCoverageFrom: ['backend/**/*.js', 'src/**/*.js', '!src/main.jsx'],
};
