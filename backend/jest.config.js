module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/src/tests/**/*.test.ts"],
  globalSetup: "<rootDir>/src/tests/globalSetup.ts",
  setupFiles: ["<rootDir>/src/tests/setup.ts"],
};
