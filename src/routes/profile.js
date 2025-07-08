const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Employer = require('../models/Employer');
const { getConnection } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// Configuration de multer pour l'upload d'images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'));
    }
  }
});

// Afficher le profil
router.get('/', auth.requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    console.log('User data for /profile:', user);
    const db = getConnection();
    
    // Récupérer l'historique des emplois
    const [employment] = await db.execute(`
      SELECT ue.*, e.nom as employer_name, e.secteur, e.ville
      FROM user_employment ue
      JOIN employers e ON ue.employer_id = e.id
      WHERE ue.user_id = ?
      ORDER BY ue.is_current DESC, ue.date_debut DESC
    `, [user.id]);
    console.log('Employment data for /profile:', employment);

    res.render('profile/view', {
      title: 'Mon profil - Anciens BTS SN/CIEL LJV',
      displayUser: user,
      employment,
      isOwnProfile: true,
      canViewContact: !user.opt_out_contact || true // Always true for own profile
    });
  } catch (error) {
    console.error('Erreur profil:', error);
    res.render('error', {
      message: 'Erreur lors du chargement du profil',
      error: {}
    });
  }
});

// Afficher le formulaire d'édition
router.get('/edit', auth.requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    const db = getConnection();
    
    const [sections] = await db.execute('SELECT * FROM sections ORDER BY nom');
    
    res.render('profile/edit', {
      title: 'Modifier mon profil - Anciens BTS SN/CIEL LJV',
      user,
      sections,
      error: null
    });
  } catch (error) {
    console.error('Erreur édition profil:', error);
    res.render('error', {
      message: 'Erreur lors du chargement du profil',
      error: {}
    });
  }
});

// Traitement de la modification du profil
router.post('/edit', [
  auth.requireAuth,
  upload.single('profile_picture'),
  body('prenom').trim().isLength({ min: 2 }).withMessage('Prénom requis'),
  body('nom').trim().isLength({ min: 2 }).withMessage('Nom requis'),
  body('telephone').optional().isMobilePhone('fr-FR').withMessage('Numéro de téléphone invalide'),
  body('email').optional().isEmail().withMessage('Email invalide'),
  body('linkedin').optional().isURL().withMessage('URL LinkedIn invalide'),
  body('twitter').optional().isURL().withMessage('URL Twitter invalide'),
  body('facebook').optional().isURL().withMessage('URL Facebook invalide'),
  body('site_web').optional().isURL().withMessage('URL site web invalide')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    const user = await User.findById(req.session.user.id);
    const db = getConnection();
    const [sections] = await db.execute('SELECT * FROM sections ORDER BY nom');

    if (!errors.isEmpty()) {
      return res.render('profile/edit', {
        title: 'Modifier mon profil - Anciens BTS SN/CIEL LJV',
        user,
        sections,
        error: 'Veuillez corriger les erreurs dans le formulaire'
      });
    }

    const updateData = {
      prenom: req.body.prenom,
      nom: req.body.nom,
      adresse: req.body.adresse || null,
      ville: req.body.ville || null,
      code_postal: req.body.code_postal || null,
      pays: req.body.pays || 'France',
      telephone: req.body.telephone || null,
      linkedin: req.body.linkedin || null,
      twitter: req.body.twitter || null,
      facebook: req.body.facebook || null,
      site_web: req.body.site_web || null,
      statut_emploi: req.body.statut_emploi,
      opt_out_contact: req.body.opt_out_contact === 'on',
      opt_out_directory: req.body.opt_out_directory === 'on'
    };

    // Ajouter l'image si uploadée
    if (req.file) {
      updateData.profile_picture = '/uploads/' + req.file.filename;
    }

    await User.updateProfile(req.session.user.id, updateData);

    // Mettre à jour la session
    req.session.user.prenom = updateData.prenom;
    req.session.user.nom = updateData.nom;

    res.redirect('/profile?success=1');

  } catch (error) {
    console.error('Erreur mise à jour profil:', error);
    const user = await User.findById(req.session.user.id);
    const db = getConnection();
    const [sections] = await db.execute('SELECT * FROM sections ORDER BY nom');
    
    res.render('profile/edit', {
      title: 'Modifier mon profil - Anciens BTS SN/CIEL LJV',
      user,
      sections,
      error: 'Erreur lors de la mise à jour du profil'
    });
  }
});

// Gestion des emplois
router.get('/employment', auth.requireAuth, async (req, res) => {
  try {
    const db = getConnection();
    const [employment] = await db.execute(`
      SELECT ue.*, e.nom as employer_name, e.secteur, e.ville
      FROM user_employment ue
      JOIN employers e ON ue.employer_id = e.id
      WHERE ue.user_id = ?
      ORDER BY ue.is_current DESC, ue.date_debut DESC
    `, [req.session.user.id]);

    res.render('profile/employment', {
      title: 'Mes emplois - Anciens BTS SN/CIEL LJV',
      employment
    });
  } catch (error) {
    console.error('Erreur emplois:', error);
    res.render('error', {
      message: 'Erreur lors du chargement des emplois',
      error: {}
    });
  }
});

// Ajouter un emploi
router.post('/employment/add', [
  auth.requireAuth,
  body('employer_name').trim().isLength({ min: 2 }).withMessage('Nom de l\'employeur requis'),
  body('poste').trim().isLength({ min: 2 }).withMessage('Poste requis'),
  body('date_debut').isISO8601().withMessage('Date de début invalide')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Données invalides' });
    }

    const { employer_name, poste, date_debut, date_fin, is_current, secteur, ville } = req.body;
    
    // Créer ou récupérer l'employeur
    const employer = await Employer.findOrCreate(employer_name, { secteur, ville });
    
    const db = getConnection();
    
    // Si c'est l'emploi actuel, désactiver les autres emplois actuels
    if (is_current === 'on') {
      await db.execute(
        'UPDATE user_employment SET is_current = FALSE WHERE user_id = ?',
        [req.session.user.id]
      );
    }
    
    // Ajouter le nouvel emploi
    await db.execute(`
      INSERT INTO user_employment (user_id, employer_id, poste, date_debut, date_fin, is_current)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      req.session.user.id,
      employer.id,
      poste,
      date_debut,
      date_fin || null,
      is_current === 'on'
    ]);

    res.redirect('/profile/employment');

  } catch (error) {
    console.error('Erreur ajout emploi:', error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout de l\'emploi' });
  }
});

// API pour la suggestion d'employeurs
router.get('/api/employers/suggest', auth.requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const employers = await Employer.search(q);
    res.json(employers);
  } catch (error) {
    console.error('Erreur suggestion employeurs:', error);
    res.status(500).json({ error: 'Erreur de recherche' });
  }
});

module.exports = router;
