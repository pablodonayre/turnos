const express = require('express');
const router = express.Router();
const checkNotAuthenticated = require('../../Auth/Middleware/checkNotAuthenticated');
const { marcarSchema } = require('../../../Validations/shift');
const trimRequest = require('../../../Library/Helpers/trim-request');
const validateToken = require('../../Core/Middleware/validateToken');
const jwt = require('jsonwebtoken');
const { crearEvents } = require('../../../Library/calendar');
const checkAuthenticated = require('../../Core/Middleware/checkAuthenticated');
const checkAuthenticatedApi = require('../../Core/Middleware/checkAuthenticatedApi');
const { DateTime } = require('luxon');

/* opciones de modo
    ASISTENCIA	Lectura de asistencia; ENTRADA/SALIDA.
    REGISTRO	Captura/verificación de UID.
    BLOQUEADO	Deniega habilitación.
    TEST	    Generación automática aleatoria.
*/

/* opciones de accion
    ENTRADA 	Entrada.
    SALIDA	    Salida.
    REGISTRO	Registro/verificación UID.
 */

/* opciones detalleDelResultado
    HABILITADO	        UID conocido habilitado.
    DESHABILITADO	    UID conocido bloqueado.
    NO_REGISTRADO	    UID desconocido en asistencia.
    SISTEMA_BLOQUEADO	Modo bloqueado.
    UID_YA_EXISTE	    UID existente en REGISTRO.
    UID_NUEVO	        UID nuevo en REGISTRO.
 */

/* opciones de Usuarios status
    up_to_date	No descarga usuarios[].
    update	Descarga usuarios[].
*/

/* opciones de Conectividad ESP32
    ONLINE	HTTP válido.
    DESCONOCIDO	Fallo aislado.
    OFFLINE	3 fallos /ordenes consecutivos.
 */
const modos = [
    "ASISTENCIA",
    "REGISTRO",
    "BLOQUEADO",
    "TEST",
]

const detalleDelResultado = [
    "HABILITADO",
    "DESHABILITADO",
    "NO_REGISTRADO",
    "SISTEMA_BLOQUEADO",
    "UID_YA_EXISTE",
    "UID_NUEVO",
]

const accionArray = ["ENTRADA", "SALIDA", "REGISTRO"];

// GET /dispositivos
router.get('/', checkAuthenticated, (req, res) => {
    res.render('Dispositivos/list', {
        user: req.session.user,
        is_admin: req.session.user.rol === 'ADMIN',
        title: 'Dispositivos',
        use_spaces: process.env.USE_SPACES,
        url_deactivate: '/dispositivos/eliminar',
        url_data: '/dispositivos/data'
    });
});

// GET /dispositivos/data
router.get('/data', checkAuthenticatedApi, async (req, res) => {
    const db_single = req.app.get('db_single');
    try {
        const offset = +req.query.offset || 0;
        const limit = +req.query.limit || 50;
        const search = req.query.search || '';
        const sort = req.query.sort || "";
        const order = req.query.order || 'asc';
        const filter = JSON.parse(req.query.filter || '{}');
        const sleep = req.query.sleep || 0;

        let result = {
            total: 0,
            totalNotFiltered: 0,
            rows: []
        }

        let where = '';
        let params = [];
        if (search) {
            where = 'WHERE nombre LIKE ? OR modo LIKE ? OR test_interval_ms LIKE ?';
            params = [`%${search}%`, `%${search}%`, `%${search}%`];
        }

        // order
        const allowedSort = {
            nombre: "nombre",
            modo: "modo",
            test_interval_ms: "test_interval_ms",
        }

        const sortColumn = allowedSort[sort] || "creado_fecha";
        const sortOrder = order === "desc" ? "DESC" : "ASC";

        const totalRows = await db_single(`SELECT COUNT(*) as total FROM dispositivos`);
        const rows = await db_single(`SELECT * 
            FROM dispositivos ${ where } 
            ORDER BY ${ sortColumn } ${ sortOrder } 
            LIMIT ?  OFFSET ?`,
            [...params, limit, offset]
        );

        result.totalNotFiltered = totalRows[0].total || 0,
        result.total = rows.length || 0;
        result.rows = rows || [];

        return res.json(result);
    } catch (err) {
        console.error('ERROR DATA DISPOSITIVOS', err);
        return res.status(500).json({ flash: 'danger', msg: 'Error al cargar dispositivos.' });
    }
});


// POST /dispositivos/data
router.post('/data', trimRequest.body, checkAuthenticated/*, checkAdmin*/, async (req, res) => {
    const db_single = req.app.get('db_single');
    try {
        // const { error, value } = usuarioSchema.validate(req.body.data);
        // if (error) {
        //     return res.json({ flash: 'danger', msg: error.details[0].message });
        // }

        const { nombre, modo, test_interval_ms } = req.body;

        const existe = await db_single('SELECT id FROM dispositivos WHERE nombre = ? LIMIT 1', [nombre]);
        if (existe.length > 0) {
            return res.json({ flash: 'danger', msg: 'Ya existe un dispositivo con ese nombre.' });
        }

        const ahora = DateTime.now().ts;

        await db_single(
            `INSERT INTO dispositivos
            (nombre, modo, test_interval_ms, creado_fecha)
            VALUES (?, ?, ?, ?)`,
            [nombre, modo, test_interval_ms, ahora]
        );

        return res.json({ flash: 'success', msg: 'Dispositivo creado correctamente.' });
    } catch (err) {
        console.error('ERROR CREAR DISPOSITIVO', err);
        return res.status(500).json({ flash: 'danger', msg: 'Error interno del servidor.' });
    }
});

// PUT /dispositivos/data
router.put('/data/:id', trimRequest.body, checkAuthenticated/*, checkAdmin*/, async (req, res) => {
    const db_single = req.app.get('db_single');
    const { data } = req.body;

    try {
        let sql = 'UPDATE dispositivos SET ';
        let values = [];

        if (data.nombre != undefined) {
            sql += 'nombre = ?';
            values.push(data.nombre);
        }
        if (data.modo != undefined) {
            sql += values.length > 0 ? ', modo = ?' : 'modo = ?';
            values.push(data.modo === '' ? 0 : data.modo);
        }
        if (data.test_interval_ms != undefined) {
            sql += values.length > 0 ? ', test_interval_ms = ?' : 'test_interval_ms = ?';
            values.push(data.test_interval_ms === '' ? 0 : data.test_interval_ms);
        }

        if (values.length === 0) {
            return res.json({ flash: 'danger', msg: 'Formulario vacío' });
        }

        sql += ' WHERE id = ?';
        values.push(req.params.id);

        await db_single(sql, values);

        return res.json({ flash: 'success', msg: 'Dispositivo actualizado satisfactoriamente' });
    } catch (err) {
        console.error('ERROR ACTUALIZAR DISPOSITIVO', err);
        return res.status(500).json({ flash: 'danger', msg: 'Error interno del servidor' });
    }
});



router.post('/', trimRequest.body, /*validateToken,*/ async (req, res) => {
    const db_single = req.app.get('db_single');
    try {

        console.log('dispositivo')


        // const {user_id} = req.token_data;
        const { dispositivo, modo_actual, firmware_version } = req.body;
        console.log(req.body)

        const response = {
            "ok": true, // sale de la info del dispositivo, todavía pendiente
            "modo_recibido": modo_actual, // sale de la info del dispositivo, todavía pendiente
            "orden_pendiente": null,
        }


        return res.json(response)

      

    } catch (e) {
        console.error('ERROR EN MARCAR', e);
        return res.status(500).json({ "flash": "danger", "msg": "Error interno del servidor." });
    }
});


module.exports = router;