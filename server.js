const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de sécurité
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limite chaque IP à 100 requêtes par windowMs
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.'
});
app.use(limiter);

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

// Configuration du moteur de templates
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

// Fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Middleware d'authentification
app.use(require('./src/middleware/auth'));

// Routes
app.use('/', require('./src/routes/auth'));
app.use('/profile', require('./src/routes/profile'));
app.use('/users', require('./src/routes/users'));
app.use('/admin', require('./src/routes/admin'));

// Middleware de gestion d'erreurs
app.use((err, req, res, next) => {
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

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
