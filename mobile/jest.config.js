/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  transform: {
    '^.+\.tsx?$': ['ts-jest', { tsconfig: { resolveJsonModule: true, esModuleInterop: true, module: 'commonjs', strict: true, types: ['jest', 'node'] } }],
  },
};
