module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // Style
    'indent': ['error', 2],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'no-trailing-spaces': 'error',
    'no-multiple-empty-lines': ['error', { max: 2 }],

    // Variables
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-var': 'error',
    'prefer-const': 'error',

    // Fonctions
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',

    // Sécurité
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',

    // Meilleures pratiques
    'eqeqeq': ['error', 'always'],
    'no-implicit-globals': 'error',
    'no-return-await': 'error',
    'require-await': 'error'
  },
  overrides: [
    {
      files: ['tests/**/*.js'],
      env: {
        jest: true
      },
      rules: {
        'no-console': 'off'
      }
    },
    {
      files: ['public/js/app.js'],
      env: {
        browser: true,
        node: false
      },
      globals: {
        // Add any other global variables used in app.js that are not standard browser globals
        // For example, if you use jQuery, you might add '$: 'readonly'
      },
      rules: {
        // Specific rules for browser-side JS if needed
      }
    }
  ]
};
