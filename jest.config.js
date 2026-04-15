/** @type {import('jest').Config} */
module.exports = {
  // ts-jest handles both .ts and .tsx; we use isolatedModules for speed
  // since the full project is typechecked by `npm run build`.
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react',
          esModuleInterop: true,
          target: 'ES2020',
          module: 'commonjs',
          lib: ['ES2020', 'DOM'],
          strict: false,
          isolatedModules: true,
        },
      },
    ],
  },
};
