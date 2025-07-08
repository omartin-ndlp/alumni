const express = require('express');
const User = require('../models/User');
const Employer = require('../models/Employer');
const { getConnection } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// Liste des anciens
router.get('/', auth.requireAuth, async (req, res) => {
  try {
    const { search, sort, annee_diplome, section_id, employer_id, page = 1 } = req.query;
    const limit = 10; // Number of users per page
    const offset = (parseInt(page) - 1) * limit;

    const filters = {
      search,
      sort: sort || 'name',
      show_opted_out: false,
      limit,
      offset
    };

    if (annee_diplome) filters.annee_diplome = annee_diplome;
    if (section_id) filters.section_id = section_id;
    if (employer_id) filters.employer_id = employer_id;

    const users = await User.getAll(filters);

    const db = getConnection();
    const [sections] = await db.execute('SELECT * FROM sections ORDER BY nom');
    const employers = await Employer.getWithEmployeeCount();

    const [years] = await db.execute(`
      SELECT DISTINCT annee_diplome 
      FROM users 
      WHERE is_approved = TRUE AND is_active = TRUE 
      ORDER BY annee_diplome DESC
    `);

    // Get total count for pagination
    const [totalUsersResult] = await db.execute(`
      SELECT COUNT(*) as total FROM users WHERE is_approved = TRUE AND is_active = TRUE
    `);
    const totalUsers = totalUsersResult[0].total;
    const totalPages = Math.ceil(totalUsers / limit);

    res.render('users/list', {
      title: 'Annuaire des anciens - Anciens BTS SN/CIEL LJV',
      users,
      sections,
      employers,
      years: years.map(y => y.annee_diplome),
      filters: req.query,
      pagination: {
        current: parseInt(page),
        total: totalPages,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });
    
  } catch (error) {
    console.error('Erreur liste utilisateurs:', error);
    res.render('error', {
      message: 'Erreur lors du chargement de l\'annuaire',
      error: {}
    });
  }
});

// Profil public d'un utilisateur
router.get('/:id', auth.requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    console.log('User data for /users/:id:', user);
    
    if (!user || !user.is_approved || !user.is_active) {
      return res.status(404).render('error', {
        message: 'Utilisateur non trouvé',
        error: {}
      });
    }
    
    // Vérifier si l'utilisateur a opté pour ne pas être affiché
    if (user.opt_out_directory && req.session.user.id !== user.id && !req.session.user.is_admin) {
      return res.status(404).render('error', {
        message: 'Profil non accessible',
        error: {}
      });
    }
    
    const db = getConnection();
    
    // Récupérer l'historique des emplois (seulement si pas d'opt-out)
    let employment = [];
    if (!user.opt_out_directory || req.session.user.id === user.id || req.session.user.is_admin) {
      const [employmentData] = await db.execute(`
        SELECT ue.*, e.nom as employer_name, e.secteur, e.ville
        FROM user_employment ue
        JOIN employers e ON ue.employer_id = e.id
        WHERE ue.user_id = ?
        ORDER BY ue.is_current DESC, ue.date_debut DESC
      `, [user.id]);
      employment = employmentData;
    }
    console.log('Employment data for /users/:id:', employment);
    
    // Masquer les informations de contact si opt-out et pas le propriétaire/admin
    const canViewContact = !user.opt_out_contact || req.session.user.id === user.id || req.session.user.is_admin;
    
    res.render('users/profile', {
      title: `${user.prenom} ${user.nom} - Anciens BTS SN/CIEL LJV`,
      displayUser: user,
      employment,
      canViewContact,
      isOwnProfile: req.session.user.id === user.id
    });
    
  } catch (error) {
    console.error('Erreur profil utilisateur:', error);
    res.render('error', {
      message: 'Erreur lors du chargement du profil',
      error: {}
    });
  }
});

// Liste des employeurs
router.get('/employers/list', auth.requireAuth, async (req, res) => {
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
  }
});

// Employés d'un employeur
router.get('/employers/:id', auth.requireAuth, async (req, res) => {
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
      employees
    });
    
  } catch (error) {
    console.error('Erreur détail employeur:', error);
    res.render('error', {
      message: 'Erreur lors du chargement de l\'employeur',
      error: {}
    });
  }
});

module.exports = router;
