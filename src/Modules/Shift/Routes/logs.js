const express = require('express');
const checkAuthenticated = require('../../Core/Middleware/checkAuthenticated');
const checkAuthenticatedApi = require('../../Core/Middleware/checkAuthenticatedApi');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// vamos a separar la parte render del proceso de obtencion de la data
router.get('/', checkAuthenticated, async (req, res) => {
    res.render('Shift/logs', {
        user: req.session.user,
        is_admin: req.session.user.rol === 'ADMIN',
        title: 'Logs de asistencia',
        url_data: '/logs/data',
        url_upload: '/logs/upload',
        use_spaces: process.env.USE_SPACES
    });
});

router.get('/data', checkAuthenticatedApi, async (req, res) => {
    const db_single = req.app.get('db_single');
    try {
        const { user_id, rol } = req.session.user;
        const isAdmin = rol === 'ADMIN';
        const filtroUsuarioId = isAdmin && req.query.usuario_id ? req.query.usuario_id : user_id;
        let query = `
            SELECT log.*, usuarios.nombre, usuarios.apellido
            FROM log
            JOIN usuarios ON usuarios.id = log.usuario_id
            WHERE log.usuario_id = ?
            ORDER BY log.fecha_hora DESC
        `;
        const logs = await db_single(query, [filtroUsuarioId]);
        let usuarios = [];
        if (isAdmin) {
            usuarios = await db_single('SELECT id, nombre, apellido FROM usuarios WHERE estatus = 1 ORDER BY nombre');
        }
        return res.json({
            logs: logs,
            usuarios: usuarios,
            filtroUsuarioId: Number(filtroUsuarioId),
        });
    } catch (err) {
        console.error('ERROR EN LOGS', err);
        res.status(500).send('Error al cargar los logs');
    }
});

router.post('/upload', checkAuthenticatedApi, async (req, res) => {
    let response_message = "";

    try {
        const form = new formidable.IncomingForm();
        const uploadFolder = __dirname + "/../../../public/img/temp";

        form.multiples = true;
        form.maxFileSize = 20 * 1024 * 1024; // 20mb
        form.uploadDir = uploadFolder;

        let nombre = '';
        let newFilename = '';

        form.on('file', function (field, file) {
            const originalName = file.originalFilename || file.name;
            const tempPath = file.filepath || file.path;

            nombre = originalName.replace(/[!@#$%^&*'"/:;]/g, "");
            newFilename = Date.now() + "_" + nombre;
            fs.renameSync(tempPath, form.uploadDir + "/" + newFilename);
            file.new_name = newFilename;
        });

        form.parse(req, async (err, fields, files) => {
            if (err) {
                console.error(err);
                response_message = {
                    flash: "danger",
                    msg: "[500] There was an error parsing the files."
                };
                return res.send(response_message);
            }

            if (fields.imgUploader == 'undefined') {
                response_message = {
                    flash: "danger",
                    msg: "[500] No se ha seleccionado un archivo."
                };
                return res.send(response_message);
            }

            const files_total = files.imgUploader;
            let files_array = [];

            if (files_total.length > 0) {
                for (let file of files_total) {
                    files_array.push({ archivo_server: file.new_name, archivo_usuario: nombre });
                }
            } else {
                files_array.push({ archivo_server: files_total.new_name, archivo_usuario: nombre });
            }

            response_message = {
                flash: "success",
                msg: "Archivo subido correctamente.",
                files: files_array
            };
            return res.send(response_message);
        });

    } catch (err) {
        console.error('Upload error:', err);
        response_message = {
            flash: "danger",
            msg: "[500] No se pudo cargar el archivo. Intentelo nuevamente."
        };
        res.send(response_message);
    }
});

router.put('/data/:id', checkAuthenticatedApi, async (req, res) => {
    const db_single = req.app.get('db_single');
    const { id } = req.params;
    const { comentario, archivo_server, archivo_usuario, estatus } = req.body;
    const { user_id, rol } = req.session.user;
    const isAdmin = rol === 'ADMIN';

    try {
        const actual = await db_single(`SELECT * FROM log WHERE id = ?`, [id]);
        if (!actual.length) return res.status(404).json({ flash: 'danger', msg: 'Log no encontrado' });

        const log = actual[0];

        // un usuario normal solo puede tocar sus propios logs
        if (!isAdmin && Number(log.usuario_id) !== Number(user_id)) {
            return res.status(403).json({ flash: 'danger', msg: 'No autorizado' });
        }

        const yaCargado = !!(log.comentario && log.archivo_server);

        // un usuario normal no puede editar si ya cargó comentario y adjunto
        if (!isAdmin && yaCargado) {
            return res.status(403).json({ flash: 'danger', msg: 'Este registro ya no se puede editar' });
        }

        const cambios = {};

        if (comentario !== undefined) cambios.comentario = comentario;

        // estatus solo el admin lo puede cambiar
        if (estatus !== undefined && isAdmin) {
            cambios.estatus = estatus;
        }

        if (archivo_server) {
            const tempPath = path.join(__dirname, '..', '..', '..', 'public', 'img', 'temp', archivo_server);
            const permPath = path.join(__dirname, '..', '..', '..', 'public', 'img', 'perm', archivo_server);

            if (fs.existsSync(tempPath)) {
                fs.renameSync(tempPath, permPath);
            } else if (!fs.existsSync(permPath)) {
                return res.status(400).json({ flash: 'danger', msg: 'El archivo no se encontró en el servidor, volvé a subirlo.' });
            }

            cambios.archivo_server = archivo_server;
            cambios.archivo_usuario = archivo_usuario || archivo_server;
        }

        if (!Object.keys(cambios).length) {
            return res.json({ flash: 'danger', msg: 'Sin cambios' });
        }

        const setClause = Object.keys(cambios).map(c => `${c} = ?`).join(', ');
        await db_single(
            `UPDATE log SET ${setClause} WHERE id = ?`,
            [...Object.values(cambios), id]
        );

        res.json({ flash: 'success', msg: 'Log actualizado correctamente' });
    } catch (err) {
        console.error('ERROR AL ACTUALIZAR LOG', err);
        res.status(500).json({ flash: 'danger', msg: 'Error al actualizar el log' });
    }
});

module.exports = router;