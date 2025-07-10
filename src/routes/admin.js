const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { getConnection } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// Middleware pour toutes les routes admin
router.use(auth.requireAuth);
router.use(auth.requireAdmin);

// Dashboard admin
router.get('/', async (req, res) => {
  try {
    const db = getConnection();
    
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
      title: 'Administration - Anciens BTS SN/CIEL LJV',
      stats: stats[0],
      recentUsers,
      yearStats,
      sectionStats
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
      title: "Demandes d'inscription - Administration",
      requests
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
    await User.approveRegistration(req.params.id, true);
    res.redirect('/admin/requests?success=approved');
  } catch (error) {
    console.error('Erreur approbation:', error);
    res.redirect('/admin/requests?error=approve_failed');
  }
});

// Rejeter une demande
router.post('/requests/:id/reject', async (req, res) => {
  try {
    await User.approveRegistration(req.params.id, false);
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
    
    const db = getConnection();
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
    
    res.render('admin/users', {
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
    const db = getConnection();
    const [users] = await db.execute('SELECT is_active FROM users WHERE id = ?', [req.params.id]);
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    const newStatus = !users[0].is_active;
    await db.execute('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);
    
    res.json({ success: true, new_status: newStatus });
    
  } catch (error) {
    console.error('Erreur changement statut:', error);
    res.status(500).json({ error: 'Erreur lors du changement de statut' });
  }
});

// Gestion des sections
router.get('/sections', async (req, res) => {
  try {
    const db = getConnection();
    const [sections] = await db.execute(`
      SELECT s.*, COUNT(u.id) as user_count
      FROM sections s
      LEFT JOIN users u ON s.id = u.section_id AND u.is_approved = TRUE AND u.is_active = TRUE
      GROUP BY s.id
      ORDER BY s.nom
    `);
    
    res.render('admin/sections', {
      title: 'Gestion des sections - Administration',
      sections
    });
    
  } catch (error) {
    console.error('Erreur sections:', error);
    res.render('error', {
      message: 'Erreur lors du chargement des sections',
      error: {}
    });
  }
});

// Ajouter une section
router.post('/sections/add', [
  body('nom').trim().isLength({ min: 2 }).withMessage('Nom de section requis'),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Données invalides' });
    }
    
    const { nom, description } = req.body;
    const db = getConnection();
    
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
  }
});

// Modifier une section
router.post('/sections/:id/edit', [
  body('nom').trim().isLength({ min: 2 }).withMessage('Nom de section requis'),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Données invalides' });
    }
    
    const { nom, description } = req.body;
    const db = getConnection();
    
    await db.execute(
      'UPDATE sections SET nom = ?, description = ? WHERE id = ?',
      [nom, description || null, req.params.id]
    );
    
    res.redirect('/admin/sections?success=updated');
    
  } catch (error) {
    console.error('Erreur modification section:', error);
    res.redirect('/admin/sections?error=update_failed');
  }
});

module.exports = router;
