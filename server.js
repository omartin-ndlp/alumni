const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const i18n = require('i18n');
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config({ override: true });
}

// Initialize database connection
const { createConnection } = require('./src/config/database');

let server;

function initApp() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Configure i18n
  const i18nConfig = {
    locales: ['fr', 'es', 'en', 'de', 'tlh'], // French, Spanish, English, German, Klingon
    directory: path.join(__dirname, 'src', 'locales'),
    defaultLocale: process.env.SITE_LANGUAGE || 'fr',
    cookie: null, // Disable cookie-based language detection
    objectNotation: true,
    autoRegister: false, // Disable auto-detection from headers
    syncFiles: false, // Disable file sync
    updateFiles: false // Crucial: Disable writing new keys to files
  };
  i18n.configure(i18nConfig);


  // Middleware de sécurité
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: process.env.NODE_ENV === 'production',
  }));

  // Rate limiting
  if (process.env.NODE_ENV === 'production') {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limite chaque IP à 100 requêtes par windowMs
      message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.'
    });
    app.use(limiter);
  }

  // Middleware général
  app.use(compression());
  app.use(morgan('combined'));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Configuration des sessions
  app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 heures
    }
  }));

  // i18n middleware
  app.use(i18n.init);
  app.use((req, res, next) => {
    const siteLanguage = process.env.SITE_LANGUAGE || 'fr';
    req.setLocale(siteLanguage);
    res.locals.__ = res.__;
    next();
  });

  // Configuration du moteur de templates
  const expressLayouts = require('express-ejs-layouts');
  app.use(expressLayouts);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'src', 'views'));
  app.set('layout', 'layout');

  // Fichiers statiques
  app.use(express.static(path.join(__dirname, 'public')));

  // Middleware d'authentification
  app.use(require('./src/middleware/auth'));

  // Routes
  app.use('/', require('./src/routes/auth'));
  app.use('/profile', require('./src/routes/profile'));
  app.use('/users', require('./src/routes/users'));
  app.use('/admin', require('./src/routes/admin'));
  app.use('/api', require('./src/routes/api'));

  // Middleware de gestion d'erreurs
  app.use((err, req, res, _next) => {
    console.error(err.stack);
    res.status(500).render('error', {
      message: 'Une erreur interne est survenue',
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  });

  // Route 404
  app.use((req, res) => {
    res.status(404).render('error', {
      message: 'Page non trouvée',
      error: {}
    });
  });

  return app;
}

async function startServer() {
  try {
    // Initialiser la connexion à la base de données
    await createConnection();

    // Démarrer le serveur
    const app = initApp(); // Get the initialized app
    const PORT = process.env.PORT || 3000; // Define PORT here
    server = app.listen(PORT, () => {
      console.log(`Serveur démarré sur le port ${PORT}`);
      console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
}

// Démarrer seulement si ce fichier est exécuté directement
if (require.main === module) {
  startServer();
}

module.exports = initApp;
module.exports.server = server;
