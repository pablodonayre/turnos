const express = require('express');
const checkAuthenticated = require('../Middleware/checkAuthenticated');
const router = express.Router();


router.get('/', checkAuthenticated, (req, res) => {
    const message = req.flash('success')[0];

    res.render('Core/home', {
        message: message,
        user: req.session.user,
        is_admin: req.session.user.rol === 'ADMIN',
        title: 'Inicio',
        use_spaces: process.env.USE_SPACES
    });
});

module.exports = router;