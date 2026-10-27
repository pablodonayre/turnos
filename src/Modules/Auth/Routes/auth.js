const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const checkNotAuthenticated = require('../Middleware/checkNotAuthenticated');
const { loginSchema } = require('../../../Validations/auth');
const { validateTokenSchema } = require('../../../Validations/auth');
const trimRequest = require('../../../Library/Helpers/trim-request');


// GET - mostrar login
router.get('/', checkNotAuthenticated, (req, res) => {
    const danger = req.flash('danger')[0];
    const message = req.flash('success')[0];

    res.render('Auth/login', {
        danger: danger,
        message: message,
        use_spaces: process.env.USE_SPACES,
        title: 'Ingresar',
        action: '/auth'
    });
});


// POST - procesar login
router.post('/', trimRequest.body, checkNotAuthenticated, async (req, res) => {
    const db_single = req.app.get('db_single');

    try {

        // validando body
        const { error, value } = loginSchema.validate(req.body);

        if (error) {
            return res.json({ "flash": "danger", "msg": error.details[0].message });
        }

        const { email, password } = value;

        const rows = await db_single('SELECT * FROM usuarios WHERE correo = ? LIMIT 1', [email]);
        const user = rows[0];

        // validando las credenciales
        if (!user) {
            return res.json({ "flash": "danger", "msg": "Credenciales incorrectas" });
        }

        // validando usuario activo
        if (user.estatus == 0) {
            return res.json({ "flash": "danger", "msg": "Usuario inactivo." });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        console.log('RESULTADO COMPARE:', validPassword);

        // validando el user agent
        const user_agent = req.headers['user-agent'] || '';
        const esMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(user_agent);

        if (validPassword) {
            req.session.user = {
                user_id: user.id,
                correo: user.correo,
                nombre: user.nombre.split(' ')[0],
                rol: user.rol,
                es_movil: esMovil ? true : false
            };
            
        const bienvenido = user.rol === 'ADMIN' ? 'BIENVENIDO ADMIN' : 'BIENVENIDO';
        req.flash('success', bienvenido);

        return res.json({ "flash": "success", "redirect": "/home"});
        }

        return res.json({ "flash": "danger", "msg": "Credenciales incorrectas" });

    } catch (err) {
        console.error('ERROR EN LOGIN', err);
        return res.status(500).json({ "flash": "danger", "msg": "Error interno del servidor." });
    }
});

//POST
/**
 * KIM: Para qué sirve esta ruta??
 */
router.post('/token', trimRequest.body, async (req, res) => {
    const db_single = req.app.get('db_single');
    try {
        const { error, value } = validateTokenSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ "flash": "danger", "msg": error.details[0].message });
        }

        const { correo } = value;
        const token = req.headers['x-auth-token'];

        if (!token) {
            return res.status(400).json({ "flash": "danger", "msg": "Token no enviado en headers." });
        }
        
        const rows = await db_single (`SELECT * FROM usuarios WHERE correo = ? LIMIT 1 ` , [correo]);
        const user = rows[0];

        if (!user) {
            return res.status(404).json({ "flash": "danger", "msg": "Usuario no encontrado."});
        }
        if (user.estatus == 0) {
            return res.status(403).json({ "flash": "danger", "msg": "Usuario inactivo."});
        }
        if (!user.token || user.token !== token) {
            return res.status(401).json({ "flash": "danger", "msg": "Token inválido."});
        }

        return res.json({ "flash": "success", "msg": "Token válido", "user_id": user.id });
        
    } catch(e){
        console.error('ERROR EN TOKEN', e);
        return res.status(500).json({ "flash": "danger", "msg": "Error interno del servidor." });
    }
})

// LOGOUT
router.post('/logout', (req, res) => {
    delete req.session.user;
    res.redirect('/auth');
});

module.exports = router;