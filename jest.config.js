/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  // Only look in src/ and tests/ — scanning the whole folder is slow (and can
  // freeze when iCloud has moved generated folders to the cloud).
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testPathIgnorePatterns: ["/node_modules/", "/tests/rules/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { module: "commonjs", jsx: "react-jsx" } }],
  },
};

module.exports = config;
