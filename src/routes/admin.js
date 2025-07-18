const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { getConnection, releaseConnection } = require('../config/database');
const auth = require('../middleware/auth');
const multer = require('multer');
const upload = multer();

const router = express.Router();

// Middleware pour toutes les routes admin
router.use(auth.requireAuth);
router.use(auth.requireAdmin);

// Dashboard admin
router.get('/', async (req, res) => {
  try {
    const db = await getConnection();

    // Run cleanup for registration requests
    await User.cleanUpRegistrationRequests();

    // Statistiques générales
    const [stats] = await db.execute(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE is_approved = TRUE AND is_active = TRUE) as total_users,
        (SELECT COUNT(*) FROM registration_requests) as pending_requests,
        (SELECT COUNT(*) FROM employers) as total_employers,
        (SELECT COUNT(*) FROM user_employment WHERE is_current = TRUE) as current_employments
    `);

    // Nouvelles inscriptions récentes
    const [recentUsers] = await db.execute(`
      SELECT u.*, s.nom as section_nom
      FROM users u
      JOIN sections s ON u.section_id = s.id
      WHERE u.is_approved = TRUE
      ORDER BY u.created_at DESC
      LIMIT 5
    `);

    // Statistiques par année
    const [yearStats] = await db.execute(`
      SELECT annee_diplome, COUNT(*) as count
      FROM users
      WHERE is_approved = TRUE AND is_active = TRUE
      GROUP BY annee_diplome
      ORDER BY annee_diplome DESC
    `);

    // Statistiques par section
    const [sectionStats] = await db.execute(`
      SELECT s.nom, COUNT(u.id) as count
      FROM sections s
      LEFT JOIN users u ON s.id = u.section_id AND u.is_approved = TRUE AND u.is_active = TRUE
      GROUP BY s.id, s.nom
      ORDER BY count DESC
    `);

    res.render('admin/dashboard', {
      title: 'Tableau de bord Administrateur',
      stats: stats[0],
      recentUsers,
      yearStats,
      sectionStats,
      User: User // Pass the User model to the template
    });

  } catch (error) {
    console.error('Erreur dashboard admin:', error);
    res.render('error', {
      message: 'Erreur lors du chargement du dashboard',
      error: {}
    });
  }
});

// Gestion des demandes d'inscription
router.get('/requests', async (req, res) => {
  try {
    const requests = await User.getPendingApprovals();

    res.render('admin/requests', {
      title: 'Demandes d\'inscription - Administration',
      requests,
      query: req.query,
      protocol: req.protocol,
      host: req.get('host')
    });

  } catch (error) {
    console.error('Erreur demandes:', error);
    res.render('error', {
      message: 'Erreur lors du chargement des demandes',
      error: {}
    });
  }
});

// Approuver une demande
router.post('/requests/:id/approve', async (req, res) => {
  try {
    const key = await User.generateRegistrationKey(req.params.id);
    res.json({ success: true, key: key, requestId: req.params.id });
  } catch (error) {
    console.error('Erreur génération clé:', error);
    res.status(500).json({ success: false, error: 'key_generation_failed' });
  }
});


// Rejeter une demande
router.post('/requests/:id/reject', async (req, res) => {
  try {
    await User.rejectRegistrationRequest(req.params.id);
    res.redirect('/admin/requests?success=rejected');
  } catch (error) {
    console.error('Erreur rejet:', error);
    res.redirect('/admin/requests?error=reject_failed');
  }
});

// Gestion des utilisateurs
router.get('/users', async (req, res) => {
  try {
    const { search, sort = 'created_at', order = 'DESC', page = 1 } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;

    let query = `
      SELECT u.*, s.nom as section_nom,
             ue.poste as current_position,
             e.nom as current_employer
      FROM users u 
      JOIN sections s ON u.section_id = s.id 
      LEFT JOIN user_employment ue ON u.id = ue.user_id AND ue.is_current = TRUE
      LEFT JOIN employers e ON ue.employer_id = e.id
      WHERE 1=1
    `;

    const params = [];

    if (search) {
      query += ' AND (u.nom LIKE ? OR u.prenom LIKE ? OR u.email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY u.${sort} ${order} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const db = await getConnection();
    const [users] = await db.execute(query, params);

    // Compter le total pour la pagination
    let countQuery = 'SELECT COUNT(*) as total FROM users u WHERE 1=1';
    const countParams = [];

    if (search) {
      countQuery += ' AND (u.nom LIKE ? OR u.prenom LIKE ? OR u.email LIKE ?)';
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }

    const [countResult] = await db.execute(countQuery, countParams);
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.render('users/list', {
      title: 'Gestion des utilisateurs - Administration',
      users,
      pagination: {
        current: parseInt(page),
        total: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filters: req.query
    });

  } catch (error) {
    console.error('Erreur gestion utilisateurs:', error);
    res.render('error', {
      message: 'Erreur lors du chargement des utilisateurs',
      error: {}
    });
  }
});

// Désactiver/Activer un utilisateur
router.post('/users/:id/toggle-status', async (req, res) => {
  try {
    const db = await getConnection();
    const [users] = await db.execute('SELECT is_active FROM users WHERE id = ?', [req.params.id]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const newStatus = !users[0].is_active;
    await db.execute('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);

    res.redirect('/admin/users?success=status_updated');

  } catch (error) {
    console.error('Erreur changement statut:', error);
    res.status(500).json({ error: 'Erreur lors du changement de statut' });
  }
});

// Gestion des sections
router.get('/sections', async (req, res) => {
  let db;
  try {
    db = await getConnection();
    const [sections] = await db.execute(`
      SELECT s.*, COUNT(u.id) as user_count
      FROM sections s
      LEFT JOIN users u ON s.id = u.section_id AND u.is_approved = TRUE AND u.is_active = TRUE
      GROUP BY s.id
      ORDER BY s.nom
    `);

    res.render('admin/sections', {
      title: 'Gestion des sections - Administration',
      sections,
      query: req.query
    });

  } catch (error) {
    console.error('Erreur sections:', error);
    res.render('error', {
      message: 'Erreur lors du chargement des sections',
      error: {}
    });
  } finally {
    if (db) releaseConnection(db);
  }
});

// Ajouter une section
router.post('/sections/add', [
  body('nom').trim().isLength({ min: 2 }).withMessage('Nom de section requis'),
  body('description').optional().trim()
], async (req, res) => {
  let db;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Données invalides' });
    }

    const { nom, description } = req.body;
    db = await getConnection();

    await db.execute(
      'INSERT INTO sections (nom, description) VALUES (?, ?)',
      [nom, description || null]
    );

    res.redirect('/admin/sections?success=added');

  } catch (error) {
    console.error('Erreur ajout section:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.redirect('/admin/sections?error=duplicate');
    } else {
      res.redirect('/admin/sections?error=add_failed');
    }
  } finally {
    if (db) releaseConnection(db);
  }
});

// Modifier une section
router.post('/sections/:id/edit', [
  body('nom').trim().isLength({ min: 2 }).withMessage('Nom de section requis'),
  body('description').optional().trim()
], async (req, res) => {
  let db;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Données invalides' });
    }

    const { nom, description } = req.body;
    db = await getConnection();

    await db.execute(
      'UPDATE sections SET nom = ?, description = ? WHERE id = ?',
      [nom, description || null, req.params.id]
    );

    res.redirect('/admin/sections?success=updated');

  } catch (error) {
    console.error('Erreur modification section:', error);
    res.redirect('/admin/sections?error=update_failed');
  } finally {
    if (db) releaseConnection(db);
  }
});

// Supprimer une section
router.post('/sections/:id/delete', auth.requireAuth, async (req, res) => {
  let db;
  try {
    const { id } = req.params;
    db = await getConnection();

    // Vérifier que la section n'est pas référencée par des utilisateurs
    const [usersInSection] = await db.execute(
      'SELECT id FROM users WHERE section_id = ?',
      [id]
    );

    if (usersInSection.length > 0) {
      return res.redirect('/admin/sections?error=section_in_use');
    }

    await db.execute('DELETE FROM sections WHERE id = ?', [id]);

    res.redirect('/admin/sections?success=deleted');

  } catch (error) {
    console.error('Erreur suppression section:', error);
    res.redirect('/admin/sections?error=delete_failed');
  } finally {
    if (db) releaseConnection(db);
  }
});

// Placeholder for employer export
router.get('/export/employers', (req, res) => {
  res.render('admin/export-employers', {
    title: 'Exportation des Employeurs - Administration'
  });
});

// Admin: Edit User Profile (GET)
router.get('/users/edit/:id', async (req, res) => {
  let db;
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).render('error', { message: 'Utilisateur non trouvé', error: {} });
    }

    db = await getConnection();
    const [sections] = await db.execute('SELECT * FROM sections ORDER BY nom');

    res.render('admin/user-edit', {
      title: `Modifier ${user.prenom} ${user.nom} - Administration`,
      editUser: user,
      sections,
      errors: {},
      oldInput: {}
    });

  } catch (error) {
    console.error('Erreur chargement page modification utilisateur (Admin):', error);
    res.render('error', { message: 'Erreur lors du chargement du profil utilisateur', error: {} });
  } finally {
    if (db) releaseConnection(db);
  }
});

// Admin: Edit User Profile (POST)
router.post('/users/edit/:id', upload.none(), [
  body('prenom').trim().isLength({ min: 1 }).withMessage('Le prénom est requis.'),
  body('nom').trim().isLength({ min: 1 }).withMessage('Le nom est requis.'),
  body('email').isEmail().withMessage('Adresse email invalide.').normalizeEmail(),
  body('annee_diplome').isInt({ min: 1900, max: new Date().getFullYear() + 5 }).withMessage('Année de diplôme invalide.'),
  body('section_id').isInt().withMessage('Section invalide.'),
  body('is_admin').optional().toBoolean().default(false),
  body('is_approved').optional().toBoolean().default(false),
  body('is_active').optional().toBoolean().default(false),
  body('opt_out_contact').optional().toBoolean().default(false),
  body('opt_out_directory').optional().toBoolean().default(false),
  body('telephone').optional().trim(),
  body('linkedin').optional({ checkFalsy: true }).trim().isURL().withMessage('Lien LinkedIn invalide.'),
  body('twitter').optional({ checkFalsy: true }).trim().isURL().withMessage('Lien Twitter invalide.'),
  body('facebook').optional({ checkFalsy: true }).trim().isURL().withMessage('Lien Facebook invalide.'),
  body('site_web').optional({ checkFalsy: true }).trim().isURL().withMessage('Lien Site Web invalide.'),
  body('adresse').optional().trim(),
  body('code_postal').optional().trim(),
  body('ville').optional().trim(),
  body('pays').optional().trim(),
  body('description').optional().trim()
], async (req, res) => {
  let db;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const user = await User.findById(req.params.id);
      db = await getConnection();
      const [sections] = await db.execute('SELECT * FROM sections ORDER BY nom');
      return res.render('admin/user-edit', {
        title: `Modifier ${user.prenom} ${user.nom} - Administration`,
        editUser: user,
        sections,
        errors: errors.mapped(),
        oldInput: req.body
      });
    }

    const userId = req.params.id;
    const { 
      prenom, nom, email, annee_diplome, section_id, is_admin, is_approved, is_active,
      opt_out_contact, opt_out_directory, telephone, linkedin, twitter, facebook, site_web,
      adresse, code_postal, ville, pays, description, statut_emploi
    } = req.body;

    const userData = {
      prenom, nom, email, annee_diplome, section_id,
      is_admin: is_admin || false,
      is_approved: is_approved || false,
      is_active: is_active || false,
      opt_out_contact: opt_out_contact || false,
      opt_out_directory: opt_out_directory || false,
      telephone: telephone || null,
      linkedin: linkedin || null,
      twitter: twitter || null,
      facebook: facebook || null,
      site_web: site_web || null,
      statut_emploi: statut_emploi === '' ? null : statut_emploi,
      adresse: adresse || null,
      code_postal: code_postal || null,
      ville: ville || null,
      pays: pays || null,
      description: description || null
    };

    await User.updateProfile(userId, userData, 'admin');

    res.redirect(`/users/${userId}?success=user_updated`);

  } catch (error) {
    console.error('Erreur modification utilisateur (Admin):', error);
    res.render('error', { message: 'Erreur lors de la modification du profil utilisateur', error: {} });
  } finally {
    if (db) releaseConnection(db);
  }
});

module.exports = router;
