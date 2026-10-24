// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Resolve the `~/` (this app) and `@/` (shared website code) aliases from tsconfig.json.
    settings: { "import/resolver": { typescript: { project: "./tsconfig.json" } } },
    // TypeScript already checks named imports (this rule misreads enums such as Notifications.AndroidImportance).
    rules: { "import/namespace": "off" },
  },
  { ignores: ["dist/*", ".expo/*"] },
]);
