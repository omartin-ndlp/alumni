const express = require('express');
const User = require('../models/User');
const Employer = require('../models/Employer');
const { getConnection, releaseConnection } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// Liste des anciens
router.get('/', auth.requireAuth, async (req, res) => {
  let db;
  try {
    const { search, sort, page = 1, show_admins } = req.query;
    const limit = 10; // Number of users per page
    const offset = (parseInt(page) - 1) * limit;

    const filters = {
      search,
      sort: sort || 'name',
      show_admins: show_admins === 'true', // Convert string to boolean
      limit,
      offset
    };

    if (req.query.annee_diplome) filters.annee_diplome = req.query.annee_diplome;
    if (req.query.section_id) filters.section_id = req.query.section_id;
    if (req.query.employer_id) filters.employer_id = req.query.employer_id;

    const { users, total } = await User.getAll(filters);

    db = await getConnection();

    const [sections] = await db.execute('SELECT * FROM sections ORDER BY nom');
    const employers = await Employer.getWithEmployeeCount();

    const [years] = await db.execute(`
      SELECT DISTINCT annee_diplome 
      FROM users 
      WHERE is_approved = TRUE AND is_active = TRUE 
      ORDER BY annee_diplome DESC
    `);

    const totalPages = Math.ceil(total / limit);

    res.render('users/list', {
      title: 'Annuaire des anciens - Anciens BTS SN/CIEL LJV',
      users,
      sections,
      employers,
      years: years.map(y => y.annee_diplome),
      filters: { ...req.query, show_admins: show_admins === 'true' },
      pagination: {
        current: parseInt(page),
        total: totalPages,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      },
      User // Pass the User model
    });

  } catch (error) {
    console.error('Erreur liste utilisateurs:', error);
    res.render('error', {
      message: 'Erreur lors du chargement de l\'annuaire',
      error: {}
    });
  } finally {
    if (db) {
      releaseConnection(db);
    }
  }
});

// Profil public d'un utilisateur
router.get('/:id', auth.requireAuth, async (req, res) => {
  let db;
  try {
    const user = await User.findById(req.params.id);

    if (!user || !user.is_approved || !user.is_active) {
      return res.status(404).render('error', {
        message: 'Utilisateur non trouvé',
        error: {}
      });
    }

    db = await getConnection();

    // Récupérer l'historique des emplois
    let employment = [];
    const [employmentData] = await db.execute(`
      SELECT ue.*, e.nom as employer_name, e.secteur, e.ville
      FROM user_employment ue
      JOIN employers e ON ue.employer_id = e.id
      WHERE ue.user_id = ?
      ORDER BY ue.is_current DESC, ue.date_debut DESC
    `, [user.id]);
    employment = employmentData;

    res.render('users/profile', {
      title: `${user.prenom} ${user.nom} - Anciens BTS SN/CIEL LJV`,
      displayUser: user,
      employment,
      canViewContact: true,
      isOwnProfile: req.session.user.id === user.id,
      isAdmin: req.session.user.is_admin,
      User // Pass the User model
    });
    

  } catch (error) {
    console.error('Erreur profil utilisateur:', error);
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

// Liste des employeurs
router.get('/employers/list', auth.requireAuth, async (req, res) => {
  let db;
  try {
    const employers = await Employer.getWithEmployeeCount();

    res.render('users/employers', {
      title: 'Employeurs - Anciens BTS SN/CIEL LJV',
      employers
    });

  } catch (error) {
    console.error('Erreur liste employeurs:', error);
    res.render('error', {
      message: 'Erreur lors du chargement des employeurs',
      error: {}
    });
  } finally {
    if (db) {
      releaseConnection(db);
    }
  }
});

// Employés d'un employeur
router.get('/employers/:id', auth.requireAuth, async (req, res) => {
  let db;
  try {
    const employer = await Employer.findById(req.params.id);

    if (!employer) {
      return res.status(404).render('error', {
        message: 'Employeur non trouvé',
        error: {}
      });
    }

    const employees = await Employer.getEmployees(req.params.id);

    res.render('users/employer-detail', {
      title: `${employer.nom} - Employeurs - Anciens BTS SN/CIEL LJV`,
      employer,
      employees,
      User // Pass the User model
    });

  } catch (error) {
    console.error('Erreur détail employeur:', error);
    res.render('error', {
      message: 'Erreur lors du chargement de l\'employeur',
      error: {}
    });
  } finally {
    if (db) {
      releaseConnection(db);
    }
  }
});

// API endpoint for fetching users (for AJAX)
router.get('/api/users', auth.requireAuth, async (req, res) => {
  let db;
  try {
    const { search, sort, page = 1, show_admins } = req.query;
    const limit = 10; // Number of users per page
    const offset = (parseInt(page) - 1) * limit;

    const filters = {
      search,
      sort: sort || 'name',
      show_admins: show_admins === 'true', // Convert string to boolean
      limit,
      offset
    };

    if (req.query.annee_diplome) filters.annee_diplome = req.query.annee_diplome;
    if (req.query.section_id) filters.section_id = req.query.section_id;
    if (req.query.employer_id) filters.employer_id = req.query.employer_id;

    const { users, total } = await User.getAll(filters);

    const totalPages = Math.ceil(total / limit);

    res.json({
      users,
      pagination: {
        current: parseInt(page),
        total: totalPages,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Erreur API utilisateurs:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des utilisateurs' });
  } finally {
    if (db) {
      releaseConnection(db);
    }
  }
});

module.exports = router;