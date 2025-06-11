const User = require('../models/User');

// Middleware pour ajouter les informations utilisateur à toutes les vues
const addUserToLocals = async (req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.isLoggedIn = !!req.session.user;
  res.locals.isAdmin = req.session.user?.is_admin || false;
  res.locals.title = res.locals.title || 'Anciens BTS SN/CIEL LJV'; // Add default title
  next();
};

// Middleware pour vérifier l'authentification
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
  
  if (!req.session.user.is_approved) {
    return res.render('pending-approval', {
      title: 'Compte en attente d\'approbation'
    });
  }
  
  next();
};

// Middleware pour vérifier les droits administrateur
const requireAdmin = (req, res, next) => {
  if (!req.session.user || !req.session.user.is_admin) {
    return res.status(403).render('error', {
      message: 'Accès refusé - Droits administrateur requis',
      error: {}
    });
  }
  next();
};

// Middleware pour rediriger les utilisateurs connectés
const redirectIfLoggedIn = (req, res, next) => {
  if (req.session.user && req.session.user.is_approved) {
    return res.redirect('/dashboard');
  }
  next();
};

// Export the main middleware function for app.use()
module.exports = addUserToLocals;

// Export other middleware functions as properties
module.exports.requireAuth = requireAuth;
module.exports.requireAdmin = requireAdmin;
module.exports.redirectIfLoggedIn = redirectIfLoggedIn;
