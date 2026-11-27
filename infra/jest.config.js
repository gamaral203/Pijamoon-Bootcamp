module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    // .mjs entra para o teste conseguir carregar o código das Lambdas (backend/).
    '^.+\.(tsx?|mjs)$': ['@swc/jest']
  },
  setupFilesAfterEnv: ['aws-cdk-lib/testhelpers/jest-autoclean'],
};
