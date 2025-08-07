const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { formatDateToFrench } = require('../utils/dateFormatter');
const Employer = require('../models/Employer');
const { getConnection, releaseConnection } = require('../config/database');
const auth = require('../middleware/auth');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const { formatDate } = require('../utils/dateFormatter');

const router = express.Router();

// Afficher le profil
router.get('/', auth.requireAuth, async (req, res) => {
  let db;
  try {
    const user = await User.findById(req.session.user.id);
    db = await getConnection();

    // Récupérer l'historique des emplois
    const [employment] = await db.execute(`
      SELECT ue.*, e.nom as employer_name, e.secteur, e.ville
      FROM user_employment ue
      JOIN employers e ON ue.employer_id = e.id
      WHERE ue.user_id = ?
      ORDER BY ue.is_current DESC, ue.date_debut DESC
    `, [user.id]);

    res.render('profile/view', {
      title: 'Mon profil - Anciens BTS SN/CIEL LJV',
      displayUser: user,
      employment,
      isOwnProfile: true,
      canViewContact: true,
      User: User, // Pass the User model to the template
      formatDate: formatDate // Pass the date formatting utility
    });
  } catch (error) {
    console.error('Erreur profil:', error);
    res.render('error', {
      message: 'Erreur lors du chargement du profil',
      error: {}
    });
  } finally {
    if (db) {
      releaseConnection(db);
    }
  }
});

// Afficher le formulaire d'édition
router.get('/edit', auth.requireAuth, async (req, res) => {
  let db;
  try {
    const user = await User.findById(req.session.user.id);
    db = await getConnection();

    const [sections] = await db.execute('SELECT * FROM sections ORDER BY nom');

    res.render('profile/edit', {
      title: 'Modifier mon profil - Anciens BTS SN/CIEL LJV',
      user,
      sections,
      error: null,
      isAdmin: req.session.user.is_admin
    });
  } catch (error) {
    console.error('Erreur édition profil:', error);
    res.render('error', {
      message: 'Erreur lors du chargement du profil',
      error: {}
    });
  } finally {
    if (db) {
      releaseConnection(db);
    }
  }
});

// Traitement de la modification du profil
router.post('/edit', upload.none(), [
  auth.requireAuth,
  body('prenom').trim().isLength({ min: 2 }).withMessage('Prénom requis'),
  body('nom').trim().isLength({ min: 2 }).withMessage('Nom requis'),
  body('telephone').optional({ checkFalsy: true }).isMobilePhone('fr-FR').withMessage('Numéro de téléphone invalide'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email invalide'),
  body('linkedin').optional({ checkFalsy: true }).isURL().withMessage('URL LinkedIn invalide'),
  body('twitter').optional({ checkFalsy: true }).isURL().withMessage('URL Twitter invalide'),
  body('facebook').optional({ checkFalsy: true }).isURL().withMessage('URL Facebook invalide'),
  body('site_web').optional({ checkFalsy: true }).isURL().withMessage('URL site web invalide'),
  body('description').optional().trim(),
  body('email').optional().isEmail().withMessage('Email invalide'),
  body('annee_diplome').optional().isInt({ min: 1900, max: new Date().getFullYear() + 5 }).withMessage('Année de diplôme invalide.'),
  body('section_id').optional().isInt().withMessage('Section invalide.')
], async (req, res) => {
  let db;
  try {
    const errors = validationResult(req);
    const user = await User.findById(req.session.user.id);
    db = await getConnection();
    const [sections] = await db.execute('SELECT * FROM sections ORDER BY nom');

    if (!errors.isEmpty()) {
      console.log(errors.array()); // Log validation errors
      return res.render('profile/edit', {
        title: 'Modifier mon profil - Anciens BTS SN/CIEL LJV',
        user,
        sections,
        error: req.__('profile.edit.alerts.error'), // Use translation key
        validationErrors: errors.array(), // Pass validation errors to the template
        isAdmin: req.session.user.is_admin
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
      statut_emploi: req.body.statut_emploi === '' ? null : req.body.statut_emploi,
      description: req.body.description || null,
    };

    // Only allow admins to update these fields
    if (req.session.user.is_admin) {
      updateData.email = req.body.email;
      updateData.annee_diplome = req.body.annee_diplome;
      updateData.section_id = req.body.section_id;
    }

    await User.updateProfile(req.session.user.id, updateData, 'user');

    // Mettre à jour la session
    req.session.user.prenom = updateData.prenom;
    req.session.user.nom = updateData.nom;
    if (req.session.user.is_admin) {
      req.session.user.email = updateData.email;
      req.session.user.annee_diplome = updateData.annee_diplome;
      req.session.user.section_id = updateData.section_id;
    }

    if (req.session.user.is_admin && req.query.userId) {
      res.redirect(`/profile/${req.query.userId}?success=1`);
    } else {
      res.redirect('/profile?success=1');
    }

  } catch (error) {
    console.error('Erreur mise à jour profil:', error);
    const user = await User.findById(req.session.user.id);
    const db = await getConnection();
    const [sections] = await db.execute('SELECT * FROM sections ORDER BY nom');

    res.render('profile/edit', {
      title: 'Modifier mon profil - Anciens BTS SN/CIEL LJV',
      user,
      sections,
      error: 'Erreur lors de la mise à jour du profil'
    });
  } finally {
    if (db) {
      releaseConnection(db);
    }
  }
});

// Gestion des emplois
router.get('/employment', auth.requireAuth, async (req, res) => {
  let db;
  try {
    db = await getConnection();
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
  } finally {
    if (db) {
      releaseConnection(db);
    }
  }
});

// Ajouter un emploi
router.post('/employment/add', [
  auth.requireAuth,
  body('employer_name').trim().isLength({ min: 2 }).withMessage('Nom de l\'employeur requis'),
  body('poste').trim().isLength({ min: 2 }).withMessage('Poste requis'),
  body('date_debut').isISO8601().withMessage('Date de début invalide')
], async (req, res) => {
  let db;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Données invalides' });
    }

    const { employer_name, poste, date_debut, date_fin, is_current, secteur, ville } = req.body;

    // Créer ou récupérer l'employeur
    const employer = await Employer.findOrCreate(employer_name, { secteur, ville });

    db = await getConnection();

    // Si c'est l'emploi actuel, désactiver les autres emplois actuels
    if (is_current === true) {
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
      is_current === true
    ]);

    res.redirect('/profile/employment');

  } catch (error) {
    console.error('Erreur ajout emploi:', error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout de l\'emploi' });
  } finally {
    if (db) {
      releaseConnection(db);
    }
  }
});

// Mettre à jour un emploi
router.post('/employment/:id', [
  auth.requireAuth,
  body('poste').trim().isLength({ min: 2 }).withMessage('Poste requis'),
  body('date_debut').isISO8601().withMessage('Date de début invalide'),
  body('date_fin').optional().isISO8601().withMessage('Date de fin invalide'),
], async (req, res) => {
  let db;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Données invalides' });
    }

    const { id } = req.params;
    const { poste, date_debut, date_fin, is_current } = req.body;

    db = await getConnection();

    // Vérifier que l'emploi appartient bien à l'utilisateur connecté
    const [employment] = await db.execute(
      'SELECT user_id FROM user_employment WHERE id = ?',
      [id]
    );

    if (employment.length === 0 || employment[0].user_id !== req.session.user.id) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Si c'est l'emploi actuel, désactiver les autres emplois actuels
    if (is_current === 'on') {
      await db.execute(
        'UPDATE user_employment SET is_current = FALSE WHERE user_id = ? AND id != ?',
        [req.session.user.id, id]
      );
    }

    await db.execute(`
      UPDATE user_employment SET
        poste = ?,
        date_debut = ?,
        date_fin = ?,
        is_current = ?
      WHERE id = ?
    `, [
      poste,
      date_debut,
      date_fin || null,
      is_current === 'on',
      id
    ]);

    res.redirect('/profile/employment');

  } catch (error) {
    console.error('Erreur mise à jour emploi:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'emploi' });
  } finally {
    if (db) {
      releaseConnection(db);
    }
  }
});

// Supprimer un emploi
router.post('/employment/:id/delete', auth.requireAuth, async (req, res) => {
  let db;
  try {
    const { id } = req.params;
    db = await getConnection();

    // Vérifier que l'emploi appartient bien à l'utilisateur connecté
    const [employment] = await db.execute(
      'SELECT user_id FROM user_employment WHERE id = ?',
      [id]
    );

    if (employment.length === 0 || employment[0].user_id !== req.session.user.id) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    await db.execute('DELETE FROM user_employment WHERE id = ?', [id]);

    res.redirect('/profile/employment');

  } catch (error) {
    console.error('Erreur suppression emploi:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'emploi' });
  } finally {
    if (db) {
      releaseConnection(db);
    }
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
