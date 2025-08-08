// @ts-check

import eslint from '@eslint/js';
import tsEslint from 'typescript-eslint';
import arrow from 'eslint-plugin-prefer-arrow-functions';

export default tsEslint.config({
    files: ['src/**/*.ts'],
    plugins: {
        "prefer-arrow-functions": arrow
    },
    ignores: [
        'eslint.config.js',
        'src/tests/**/*.ts'
    ],
    extends: [
        eslint.configs.recommended,
        ...tsEslint.configs.recommended,
    ],
    rules: {
        'no-useless-catch': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        "prefer-arrow-functions/prefer-arrow-functions": [
            "warn",
            {
                "allowNamedFunctions": false,
                "classPropertiesAllowed": false,
                "disallowPrototype": false,
                "returnStyle": "unchanged",
                "singleReturnOnly": false
            }
        ],
        "arrow-body-style": ["warn", "as-needed"],
        "@typescript-eslint/no-explicit-any": "warn"
    }
});
