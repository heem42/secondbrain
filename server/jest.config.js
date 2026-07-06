/** Unit-test config for the NestJS API. Specs live next to source as *.spec.ts.
 * These are pure unit tests — Prisma is mocked, so no database is required.
 * (End-to-end tests that hit a real DB would use test/jest-e2e.json.) */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
