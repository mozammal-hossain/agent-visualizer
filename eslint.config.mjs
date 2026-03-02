import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/", "out/", "webview-ui/", "pixel-agents-main/", "node_modules/"],
  },
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
