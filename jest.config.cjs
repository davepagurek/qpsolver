const path = require('path')

module.exports = {
  // testEnvironment: 'jsdom',
  verbose: true,
  testEnvironmentOptions: {
    url: 'https://localhost/',
  },
  moduleFileExtensions: ['js', 'ts', 'tsx', 'json'],
  coveragePathIgnorePatterns: [
    'node_modules',
    '/__.*__/',
    'jest.config.mjs',
  ],
  collectCoverageFrom: ['./src/*.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
  },
  globals: {},
  setupFilesAfterEnv: [],
  testPathIgnorePatterns: ['/node_modules/'],
  moduleDirectories: ['node_modules'],
  transformIgnorePatterns: [],
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx'],
}
