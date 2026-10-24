/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  transform: { "^.+\\.tsx?$": ["ts-jest", { tsconfig: { module: "commonjs", target: "ES2020", esModuleInterop: true, isolatedModules: true }, diagnostics: false }] },
};
