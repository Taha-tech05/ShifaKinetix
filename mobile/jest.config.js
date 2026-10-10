/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}'],
  // component tests use a tiny react-native stand-in instead of the native runtime
  moduleNameMapper: { '^react-native$': '<rootDir>/__tests__/support/react-native.tsx' },
  transform: {
    '^.+\.tsx?$': ['ts-jest', { tsconfig: { resolveJsonModule: true, esModuleInterop: true, module: 'commonjs', strict: true, jsx: 'react-jsx', types: ['jest', 'node'] } }],
  },
};
