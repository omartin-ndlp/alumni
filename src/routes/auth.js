const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { getConnection } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// Page d'accueil - redirige vers login
router.get('/', auth.redirectIfLoggedIn, (req, res) => {
  res.redirect('/login');
});

// Page de connexion
router.get('/login', auth.redirectIfLoggedIn, (req, res) => {
  res.render('auth/login', {
    title: 'Connexion - Anciens BTS SN/CIEL LJV',
    error: null,
    redirect: req.query.redirect || '/dashboard'
  });
});

// Traitement de la connexion
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('password').notEmpty().withMessage('Mot de passe requis')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('auth/login', {
        title: 'Connexion - Anciens BTS SN/CIEL LJV',
        error: 'Données invalides',
        redirect: req.body.redirect || '/dashboard'
      });
    }

    const { email, password } = req.body;
    const user = await User.findByEmail(email);

    if (!user) {
      return res.render('auth/login', {
        title: 'Connexion - Anciens BTS SN/CIEL LJV',
        error: 'Email ou mot de passe incorrect',
        redirect: req.body.redirect || '/dashboard'
      });
    }

    if (!(await User.verifyPassword(password, user.password_hash))) {
      return res.render('auth/login', {
        title: 'Connexion - Anciens BTS SN/CIEL LJV',
        error: 'Email ou mot de passe incorrect',
        redirect: req.body.redirect || '/dashboard'
      });
    }

    if (!user.is_active) {
      return res.render('auth/login', {
        title: 'Connexion - Anciens BTS SN/CIEL LJV',
        error: 'Compte désactivé',
        redirect: req.body.redirect || '/dashboard'
      });
    }

    if (!user.is_approved) {
      return res.render('pending-approval', {
        title: 'Compte en attente d\'approbation'
      });
    }

    // Connexion réussie
    req.session.user = {
      id: user.id,
      email: user.email,
      prenom: user.prenom,
      nom: user.nom,
      is_admin: user.is_admin,
      is_approved: user.is_approved
    };

    await User.updateLastLogin(user.id);

    const redirectUrl = req.body.redirect || '/dashboard';
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('Erreur de connexion:', error);
    res.render('auth/login', {
      title: 'Connexion - Anciens BTS SN/CIEL LJV',
      error: 'Erreur interne, veuillez réessayer',
      redirect: req.body.redirect || '/dashboard'
    });
  }
});

// Page d'inscription
router.get('/register', auth.redirectIfLoggedIn, async (req, res) => {
  try {
    const db = await getConnection();
    const [sections] = await db.execute('SELECT * FROM sections ORDER BY nom');
    
    res.render('auth/register', {
      title: 'Inscription - Anciens BTS SN/CIEL LJV',
      sections,
      error: null,
      formData: {}
    });
  } catch (error) {
    console.error('Erreur lors du chargement des sections:', error);
    res.render('error', {
      message: 'Erreur lors du chargement de la page',
      error: {}
    });
  }
});

// Traitement de l'inscription
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('prenom').trim().isLength({ min: 2 }).withMessage('Prénom requis (min 2 caractères)'),
  body('nom').trim().isLength({ min: 2 }).withMessage('Nom requis (min 2 caractères)'),
  body('annee_diplome').isInt({ min: 1990, max: new Date().getFullYear() + 1 }).withMessage('Année de diplôme invalide'),
  body('section_id').isInt({ min: 1 }).withMessage('Section requise')
], async (req, res) => {
  try {
    const db = await getConnection();
    const [sections] = await db.execute('SELECT * FROM sections ORDER BY nom');
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('auth/register', {
        title: 'Inscription - Anciens BTS SN/CIEL LJV',
        sections,
        error: errors.array()[0].msg,
        formData: req.body
      });
    }

    const { email, prenom, nom, annee_diplome, section_id, message } = req.body;

    // Vérifier si l'email existe déjà
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.render('auth/register', {
        title: 'Inscription - Anciens BTS SN/CIEL LJV',
        sections,
        error: 'Cette adresse email est déjà utilisée',
        formData: req.body
      });
    }

    // Vérifier les demandes en attente (pour éviter les doublons)
    const [pendingRequests] = await db.execute(
      'SELECT id FROM registration_requests WHERE email = ?',
      [email]
    );

    if (pendingRequests.length > 0) {
      return res.render('auth/register', {
        title: 'Inscription - Anciens BTS SN/CIEL LJV',
        sections,
        error: 'Une demande d\'inscription est déjà en cours pour cette adresse email',
        formData: req.body
      });
    }

    // Créer la demande d'inscription
    await db.execute(`
      INSERT INTO registration_requests (email, prenom, nom, annee_diplome, section_id, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [email, prenom, nom, annee_diplome, section_id, message || null]);

    res.redirect('/register-success');

  } catch (error) {
    console.error('Erreur d\'inscription:', error);
    const db = await getConnection();
    const [sections] = await db.execute('SELECT * FROM sections ORDER BY nom');
    
    res.render('auth/register', {
      title: 'Inscription - Anciens BTS SN/CIEL LJV',
      sections,
      error: 'Erreur interne, veuillez réessayer',
      formData: req.body
    });
  }
});

// Route pour la page de succès d'inscription
router.get('/register-success', (req, res) => {
  res.render('auth/register-success', {
    title: 'Inscription réussie - Anciens BTS SN/CIEL LJV'
  });
});

// Route pour la complétion d'inscription via lien magique (GET)
router.get('/register/complete/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const request = await User.findRegistrationRequestByKey(key);

    if (!request) {
      return res.status(404).render('error', {
        message: 'Lien d\'inscription invalide ou expiré.',
        error: {}
      });
    }

    // Render the completion form
    res.render('auth/complete-registration', {
      title: 'Finaliser votre inscription',
      request, // Pass request data to the view
      error: null,
      formData: {
        email: request.email,
        prenom: request.prenom,
        nom: request.nom,
        annee_diplome: request.annee_diplome,
        section_id: request.section_id
      }
    });

  } catch (error) {
    console.error('Erreur lors du chargement de la page de complétion:', error);
    res.render('error', {
      message: 'Erreur lors du chargement de la page de complétion.',
      error: {}
    });
  }
});

// Route pour la complétion d'inscription via lien magique (POST)
router.post('/register/complete/:key', [
  body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères'),
  body('confirm_password').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Les mots de passe ne correspondent pas');
    }
    return true;
  }),
  // Add validation for other profile fields as needed
], async (req, res) => {
  try {
    const { key } = req.params;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const request = await User.findRegistrationRequestByKey(key); // Re-fetch request to re-render form
      return res.render('auth/complete-registration', {
        title: 'Finaliser votre inscription',
        request,
        error: errors.array()[0].msg,
        formData: req.body
      });
    }

    const { password, ...profileData } = req.body; // Extract password, rest is profile data

    await User.completeRegistration(key, password, profileData);

    res.redirect('/login?success=registration_complete');

  } catch (error) {
    console.error('Erreur lors de la complétion de l\'inscription:', error);
    const request = await User.findRegistrationRequestByKey(req.params.key); // Re-fetch request to re-render form
    res.render('auth/complete-registration', {
      title: 'Finaliser votre inscription',
      request,
      error: 'Erreur interne lors de la complétion de l\'inscription.',
      formData: req.body
    });
  }
});

// Déconnexion
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Erreur de déconnexion:', err);
    }
    res.redirect('/login');
  });
});

// Dashboard principal
router.get('/dashboard', auth.requireAuth, async (req, res) => {
  try {
    res.render('dashboard', {
      title: 'Accueil - Anciens BTS SN/CIEL LJV',
    });
  } catch (error) {
    console.error('Erreur dashboard:', error);
    res.render('error', {
      message: 'Erreur lors du chargement du tableau de bord',
      error: {}
    });
  }
});

module.exports = router;