const express = require('express');
const session = require('express-session');
const path = require('path');
const i18n = require('i18n');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: true,
  }));

  i18n.configure({
    locales: ['en', 'fr'],
    directory: path.join(__dirname, '../../src/locales'),
    defaultLocale: 'en',
    cookie: 'lang',
    objectNotation: true,
  });

  app.use(i18n.init);

  return app;
}

module.exports = createApp;
