const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const checkNotAuthenticated = require('../../Auth/Middleware/checkNotAuthenticated');
const { marcarSchema } = require('../../../Validations/shift');
const trimRequest = require('../../../Library/Helpers/trim-request');
const validateToken = require('../../Core/Middleware/validateToken');
const jwt = require('jsonwebtoken');
const { crearEvents } = require('../../../Library/calendar');
const checkAuthenticated = require('../../Core/Middleware/checkAuthenticated');
const checkAuthenticatedApi = require('../../Core/Middleware/checkAuthenticatedApi');
const { DateTime } = require('luxon');
const checkDevice = require('../Middleware/checkDevice');
const checkDeviceApi = require('../Middleware/checkDeviceApi');


// GET - mostrar formulario
router.get('/', [checkAuthenticated/*, checkDevice*/], (req, res) => {
    const danger = req.flash('danger')[0];
    const message = req.flash('success')[0];
    console.log('sesion')
    res.render('Sesion/form', {
        danger: danger,
        message: message,
        user: req.session.user,
        use_spaces: process.env.USE_SPACES,
        is_admin: req.session.user.rol === 'ADMIN',
        url_upload: '/logs/upload',
        title: 'Sesion',
        use_spaces: process.env.USE_SPACES,
        url_relative: '/sesion',
    });
});


// GET - obtener data del turno
router.get('/data', [checkAuthenticatedApi/*, checkDeviceApi*/], async (req, res) => {
    const db_single = req.app.get('db_single');

    try {
        // const query = `SELECT * FROM usuarios u
        //                 LEFT JOIN user_status us ON us.usuario_id = u.id`
        const query = `SELECT * FROM user_status WHERE usuario_id = ?`

        const data = await db_single(query, [req.session.user.user_id]);

        // if(data[0].estado == 1){
        const ubicacion = await db_single(`SELECT * FROM log WHERE usuario_id = ? ORDER BY id desc LIMIT 1`, [ req.session.user.user_id]);
            // data[0].ubicacion = ubicacion[0].ubicacion;
        // }

        return res.json({
            flash: 'success',
            usuario: data[0],
            ubicacion: ubicacion[0]
        })
        
    } catch (error) {
        console.log('error', error);
        return res.status(500).json({ "flash": "danger", "msg": "Error interno del servidor." });
    }
})


// POST - procesar turno
router.post('/', trimRequest.body, [checkAuthenticatedApi/*, checkDeviceApi*/], async (req, res) => {
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





module.exports = router;