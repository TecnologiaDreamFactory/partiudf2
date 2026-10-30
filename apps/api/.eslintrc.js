module.exports = {
  extends: ['eslint:recommended', 'prettier'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  env: { node: true },
  ignorePatterns: ['dist', 'node_modules'],
};
