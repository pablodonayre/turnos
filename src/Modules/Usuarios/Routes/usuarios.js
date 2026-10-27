const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const trimRequest = require('../../../Library/Helpers/trim-request');
const { usuarioSchema } = require('../../../Validations/usuario');
const checkAuthenticated = require('../../Core/Middleware/checkAuthenticated');
const checkAuthenticatedApi = require('../../Core/Middleware/checkAuthenticatedApi');
const checkAdmin = require('../../Core/Middleware/checkAdmin');
const validateToken = require('../../Core/Middleware/validateToken');



// ruta de la app
// const VERSION_USUARIOS = 1;
router.get('/', validateToken, async (req, res) => {
    console.log('usuarios')
    const db_single = req.app.get('db_single');
    try {

        // version recibida en la consulta
        const version_dispositivo = Number.parseInt(req.query.version, 10) || 0;
        console.log('v ', version_dispositivo)

        // version de la db
        const version_db = await db_single(`SELECT version FROM config`);
        const version_actual = version_db[0].version;

        // validando las versiones
        if(version_dispositivo === version_actual){
            return res.status(200).json({
                status: 'up_to_date',
                version: version_actual,
                crc32: 0 // no es necesario mandar el ultimo calculo
            })
        }

        // se requiere actualizar
        const query = `SELECT uid, CONCAT(nombre,' ', apellido) AS nombre, estatus FROM usuarios`;
            // CASE
            //     WHEN estatus = 1 THEN "true"
            //     ELSE "false"
            // END AS habilitado
        


        const usuarios = await db_single(query);
        const usuarios_array = [];
        for(let i = 0; i < usuarios.length; i++){
            usuarios_array.push({
                uid: usuarios[i].uid,
                nombre: usuarios[i].nombre,
                habilitado: usuarios[i].estatus == 1 ? true : false,
            })
        }

        // generando el checksum
        const crc32 = calcularCrc32Usuarios(usuarios);

        console.log({
            status: 'update',
            version: version_actual,
            crc32: crc32,
            usuarios: usuarios
        })


        return res.status(200).json({
            status: 'update',
            version: version_actual,
            crc32: crc32,
            usuarios: usuarios_array
        })


        // return res.status(200).json(usuarios);
    } catch (error) {
        return res.status(500).json({ flash: 'danger', msg: 'Error al cargar usuarios.' });
    }
});

// GET /usuarios
router.get('/lista', checkAuthenticated, (req, res) => {
    res.render('Usuarios/list', {
        user: req.session.user,
        is_admin: req.session.user.rol === 'ADMIN',
        title: 'Usuarios',
        use_spaces: process.env.USE_SPACES,
        url_deactivate: '/usuarios/eliminar',
        url_data: '/usuarios/data'
    });
});

// GET /usuarios/data
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
            where = 'WHERE nombre LIKE ? OR apellido LIKE ? OR correo LIKE ?';
            params = [`%${search}%`, `%${search}%`, `%${search}%`];
        }

        // order
        const allowedSort = {
            nombre: "nombre",
            apellido: "apellido",
            correo: "correo",
            rol: "rol",
            estado: "estado",
            uid: "uid"
        }

        const sortColumn = allowedSort[sort] || "creado_fecha";
        const sortOrder = order === "desc" ? "DESC" : "ASC";

        const totalRows = await db_single(`SELECT COUNT(*) as total FROM usuarios`);
        const rows = await db_single(`SELECT id, nombre, apellido, correo, rol, estatus, id_calendario, uid 
            FROM usuarios ${where} 
            ORDER BY ${ sortColumn } ${ sortOrder } 
            LIMIT ?  OFFSET ?`,
            [...params, Number(limit), Number(offset)]
        );

        result.totalNotFiltered = totalRows[0].total || 0,
        result.total = rows.length || 0;
        result.rows = rows || [];

        return res.json(result);
    } catch (err) {
        console.error('ERROR DATA USUARIOS', err);
        return res.status(500).json({ flash: 'danger', msg: 'Error al cargar usuarios.' });
    }
});

// GET /usuarios/nuevo
router.get('/nuevo', checkAuthenticated, checkAdmin, (req, res) => {
    const danger = req.flash('danger')[0];
    const message = req.flash('success')[0];

    res.render('Usuarios/nuevo', {
        danger: danger,
        message: message,
        user: req.session.user,
        title: 'Nuevo usuario',
        use_spaces: process.env.USE_SPACES,
        action: '/usuarios/nuevo'
    });
});

// POST /usuarios/nuevo
router.post('/nuevo', trimRequest.body, checkAuthenticated, checkAdmin, async (req, res) => {
    const db_pool = req.app.get('db_pool');
    const conn = await db_pool.connection(); 

    try {
        const { error, value } = usuarioSchema.validate(req.body.data);
        if (error) {
            return res.json({ flash: 'danger', msg: error.details[0].message });
        }

        await conn.query('START TRANSACTION;');
        await conn.query('SET autocommit = 0;');

        const { nombre, apellido, correo, password, rol, estatus, sueldo, celular,
                fecha_nacimiento, fecha_ingreso, id_calendario, ingreso, salida, uid } = value;

        const existe = await conn.query('SELECT id FROM usuarios WHERE correo = ? LIMIT 1', [correo]);
        if (existe.length > 0) {
            return res.json({ flash: 'danger', msg: 'Ya existe un usuario con ese correo.' });
        }

        const hash = await bcrypt.hash(password, 10);
        const ahora = Date.now();
        const estatusVal = estatus === 'Activo' ? 1 : 0;

        await conn.query(
            `INSERT INTO usuarios
            (nombre, apellido, correo, password, rol, estatus, sueldo, celular, fecha_nacimiento, fecha_ingreso, id_calendario, ingreso, salida, creado_fecha, creado_por, token, uid)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [nombre, apellido, correo, hash, rol, estatusVal, sueldo, celular,
            fecha_nacimiento, fecha_ingreso, id_calendario,
            ingreso, salida, ahora, req.session.user.user_id, '', uid]
        );

        // como hubo cambios en la tabla de usuarios, se tiene que incrementar la version 
        await conn.query(`UPDATE config SET version = version + 1`);

        await conn.query('COMMIT;');


        return res.json({ flash: 'success', msg: 'Usuario creado correctamente.' });
    } catch (err) {
        console.error('ERROR CREAR USUARIO', err);
        return res.status(500).json({ flash: 'danger', msg: 'Error interno del servidor.' });
    }
});

// GET /usuarios/editar/:id
router.get('/editar/:id', checkAuthenticated, checkAdmin, async (req, res) => {
    const db_single = req.app.get('db_single');
    try {
        const rows = await db_single('SELECT * FROM usuarios WHERE id = ? LIMIT 1', [req.params.id]);
        if (!rows[0]) return res.status(404).send('Usuario no encontrado');

        res.render('Usuarios/editar', {
            usuario_id: req.params.id,
            user: req.session.user,
            title: 'Editar usuario',
            use_spaces: process.env.USE_SPACES,
            action_info: `/usuarios/editar/${req.params.id}/info`,
            action_calendario: `/usuarios/editar/${req.params.id}/calendario`
        });
    } catch (err) {
        console.error('ERROR EDITAR USUARIO', err);
        res.status(500).send('Error al cargar usuario');
    }
});

// GET /usuarios/editar/:id/datos
router.get('/editar/:id/datos', checkAuthenticated, checkAdmin, async (req, res) => {
    const db_single = req.app.get('db_single');
    try {
        const rows = await db_single('SELECT * FROM usuarios WHERE id = ? LIMIT 1', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ flash: 'danger', msg: 'Usuario no encontrado' });

        return res.json({ flash: 'success', usuario: rows[0] });
    } catch (err) {
        console.error('ERROR OBTENER USUARIO', err);
        return res.status(500).json({ flash: 'danger', msg: 'Error interno del servidor' });
    }
});

// PUT /usuarios/editar/:id/info
router.put('/editar/:id/info', trimRequest.body, checkAuthenticated, checkAdmin, async (req, res) => {
    const db_pool = req.app.get('db_pool');
    const conn = await db_pool.connection(); 
    const { data } = req.body;

    try {
        let sql = 'UPDATE usuarios SET ';
        let values = [];

        if (data.nombre != undefined) {
            sql += 'nombre = ?';
            values.push(data.nombre);
        }
        if (data.apellido != undefined) {
            sql += values.length > 0 ? ', apellido = ?' : 'apellido = ?';
            values.push(data.apellido);
        }
        if (data.correo != undefined) {
            sql += values.length > 0 ? ', correo = ?' : 'correo = ?';
            values.push(data.correo);
        }
        if (data.password) {
            const hash = await bcrypt.hash(data.password, 10);
            sql += values.length > 0 ? ', password = ?' : 'password = ?';
            values.push(hash);
        }
        if (data.celular != undefined) {
            sql += values.length > 0 ? ', celular = ?' : 'celular = ?';
            values.push(data.celular);
        }
        if (data.rol != undefined) {
            sql += values.length > 0 ? ', rol = ?' : 'rol = ?';
            values.push(data.rol);
        }
        if (data.estatus != undefined) {
            sql += values.length > 0 ? ', estatus = ?' : 'estatus = ?';
            values.push(data.estatus === 'Activo' ? 1 : 0);
        }
        if (data.fecha_nacimiento != undefined) {
            sql += values.length > 0 ? ', fecha_nacimiento = ?' : 'fecha_nacimiento = ?';
            values.push(data.fecha_nacimiento);
        }
        if (data.sueldo != undefined) {
            sql += values.length > 0 ? ', sueldo = ?' : 'sueldo = ?';
            values.push(data.sueldo);
        }
        if (data.fecha_ingreso != undefined) {
            sql += values.length > 0 ? ', fecha_ingreso = ?' : 'fecha_ingreso = ?';
            values.push(data.fecha_ingreso);
        }
        if (data.uid != undefined) {
            sql += values.length > 0 ? ', uid = ?' : 'uid = ?';
            values.push(data.uid);
        }

        if (values.length === 0) {
            return res.json({ flash: 'danger', msg: 'Formulario vacío' });
        }

        sql += ' WHERE id = ?';
        values.push(req.params.id);

        await conn.query('START TRANSACTION;');
        await conn.query('SET autocommit = 0;');

        await conn.query(sql, values);

        // como hubo cambios en la tabla de usuarios, se tiene que incrementar la version 
        await conn.query(`UPDATE config SET version = version + 1`);

        await conn.query('COMMIT;');

        return res.json({ flash: 'success', msg: 'Información personal actualizada satisfactoriamente' });
    } catch (err) {
        console.error('ERROR ACTUALIZAR INFO USUARIO', err);
        return res.status(500).json({ flash: 'danger', msg: 'Error interno del servidor' });
    }
});

// PUT /usuarios/editar/:id/calendario
router.put('/editar/:id/calendario', trimRequest.body, checkAuthenticated, checkAdmin, async (req, res) => {
    const db_single = req.app.get('db_single');
    const { data } = req.body;

    try {
        let sql = 'UPDATE usuarios SET ';
        let values = [];

        if (data.id_calendario != undefined) {
            sql += 'id_calendario = ?';
            values.push(data.id_calendario);
        }
        if (data.ingreso != undefined) {
            sql += values.length > 0 ? ', ingreso = ?' : 'ingreso = ?';
            values.push(data.ingreso === '' ? 0 : data.ingreso);
        }
        if (data.salida != undefined) {
            sql += values.length > 0 ? ', salida = ?' : 'salida = ?';
            values.push(data.salida === '' ? 0 : data.salida);
        }

        if (values.length === 0) {
            return res.json({ flash: 'danger', msg: 'Formulario vacío' });
        }

        sql += ' WHERE id = ?';
        values.push(req.params.id);

        await db_single(sql, values);

        return res.json({ flash: 'success', msg: 'Calendario actualizado satisfactoriamente' });
    } catch (err) {
        console.error('ERROR ACTUALIZAR CALENDARIO USUARIO', err);
        return res.status(500).json({ flash: 'danger', msg: 'Error interno del servidor' });
    }
});

// PUT /usuarios/eliminar/:id 
router.put('/eliminar/:id', checkAuthenticated, checkAdmin, async (req, res) => {
    const db_pool = req.app.get('db_pool');
    const conn = await db_pool.connection(); 
    try {

        await conn.query('START TRANSACTION;');
        await conn.query('SET autocommit = 0;');

        await conn.query('UPDATE usuarios SET estatus = 0 WHERE id = ?', [req.params.id]);

        // como hubo cambios en la tabla de usuarios, se tiene que incrementar la version 
        await conn.query(`UPDATE config SET version = version + 1`);

        await conn.query('COMMIT;');

        return res.json({ flash: 'success', msg: 'Usuario desactivado.' });
    } catch (err) {
        console.error('ERROR ELIMINAR USUARIO', err);
        return res.status(500).json({ flash: 'danger', msg: 'Error interno del servidor.' });
    }
});




function limpiarCampoCsv(valor) {
    return String(valor)
        .replace(/,/g, ' ')
        .replace(/\r/g, ' ')
        .replace(/\n/g, ' ');
}

function construirCsvUsuarios(usuarios) {
    const lineas = [
        'uid,nombre,habilitado,reservado1,reservado2,reservado3'
    ];

    for (const usuario of usuarios) {
        const uid = limpiarCampoCsv(usuario.uid);
        const nombre = limpiarCampoCsv(usuario.nombre);
        const habilitado = usuario.estatus;// usuario.habilitado ? '1' : '0';
        console.log('h', habilitado)

        lineas.push(`${uid},${nombre},${habilitado},,,`);
    }

    // MUY IMPORTANTE:
    // CRLF + salto de línea final, tiene que ser en ese orden específico!
    return lineas.join('\r\n') + '\r\n';
}

function calcularCrc32(buffer) {
    let crc = 0xFFFFFFFF;

    for (let i = 0; i < buffer.length; i++) {
        crc ^= buffer[i];

        for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
        }
    }

    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function calcularCrc32Usuarios(usuarios) {
    const csv = construirCsvUsuarios(usuarios);

    const bytes = Buffer.from(csv, 'utf8');

    return calcularCrc32(bytes);
}

module.exports = router;