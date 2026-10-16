/** @type {import('jest').Config} */
const SEP = '[\\\\/]'; // regex class that matches / and \ (Windows paths use \)

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // the screens that end the safety flow upload on their own; the older screen tests must not call a server
  setupFiles: ['<rootDir>/__tests__/support/autoUploadOff.ts'],
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}'],
  // component tests use a tiny react-native stand-in instead of the native runtime
  moduleNameMapper: {
    // three is ES-modules only: load its module build and turn it into CommonJS (see transform below)
    '^three$': '<rootDir>/node_modules/three/build/three.module.js',
    '^react-native$': '<rootDir>/__tests__/support/react-native.tsx',
    '^react-native-safe-area-context$': '<rootDir>/__tests__/support/safe-area.tsx',
    '^@expo/vector-icons$': '<rootDir>/__tests__/support/vector-icons.tsx',
    '^expo-linear-gradient$': '<rootDir>/__tests__/support/linear-gradient.tsx',
    '^expo-blur$': '<rootDir>/__tests__/support/expo-blur.tsx',
    '^expo-router$': '<rootDir>/__tests__/support/expo-router.tsx',
  },
  // node_modules stay untouched, except three
  transformIgnorePatterns: [`${SEP}node_modules${SEP}(?!three${SEP})`],
  transform: {
    [`^.+three${SEP}build${SEP}.+\\.js$`]: '<rootDir>/jest.esm-transform.js',
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { resolveJsonModule: true, esModuleInterop: true, module: 'commonjs', strict: true, jsx: 'react-jsx', types: ['jest', 'node'] } }],
  },
};
