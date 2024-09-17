import globals from 'globals';
import babelParser from '@babel/eslint-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [{
    ignores: ["node_modules/*", "packages/*", "**/phantom_runner.js", "**/start_test.js", "**/eslint.config.mjs"],
}, ...compat.extends("eslint:recommended"), {
    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.commonjs,
            Atomics: "readonly",
            SharedArrayBuffer: "readonly",
        },

        parser: babelParser,
        ecmaVersion: 2018,
        sourceType: "module",

        parserOptions: {
            allowImportExportEverywhere: true,
            requireConfigFile: false,
        },
    },

    rules: {
        "linebreak-style": ["error", "unix"],
        quotes: ["error", "single"],
        semi: ["error", "always"],
        "no-console": "off",
    },
}];
