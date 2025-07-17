const express = require('express');
const Employer = require('../models/Employer');
const auth = require('../middleware/auth');

const router = express.Router();

// API endpoint for searching employers
router.get('/employers/search', auth.requireAuth, async (req, res) => {
  try {
    const query = req.query.q || '';
    if (query.length < 1) {
      const employers = await Employer.search(query, 20);
      return res.json(employers);
    }
    const employers = await Employer.search(query);
    res.json(employers);
  } catch (error) {
    console.error('Erreur API recherche employeurs:', error);
    res.status(500).json({ error: 'Erreur lors de la recherche des employeurs' });
  }
});

module.exports = router;
