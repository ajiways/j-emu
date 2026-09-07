export default {
  "*.{js,cjs,mjs,ts,cts,mts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,jsonc,md,yaml,yml}": "prettier --write",
};
