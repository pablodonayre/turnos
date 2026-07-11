/**
 * crud de plantilla de turno
 * tiene inicio, fin, breve titulo
 * edición directa en modal
 */
const express = require('express');
const checkAuthenticated = require('../../Core/Middleware/checkAuthenticated');
const checkAuthenticatedApi = require('../../Core/Middleware/checkAuthenticatedApi');
const { turnoSchema } = require('../../../Validations/turnos');
const router = express.Router();


router.get('/', checkAuthenticated, (req, res) => {
    const danger = req.flash('danger')[0];
    const message = req.flash('success')[0];

    res.render('Shift/turnos', {
        danger,
        message,
        user: req.session.user,
        is_admin: req.session.user.rol === 'ADMIN',
        title: 'Turnos',
        use_spaces: process.env.USE_SPACES,
        url_data: '/turnos/data'
    });
});

router.get('/data', checkAuthenticatedApi, async (req, res) => {
    const conn = req.app.get('db_single');

    try {
        const offset = +req.query.offset || 0;
        const limit = +req.query.limit || 50;
        const search = req.query.search?.trim() || "";
        const sort = req.query.sort || "";
        const order = req.query.order || 'desc';

        const allowedSort = {
            id: "id",
            titulo: "titulo",
            inicio: "inicio",
            fin: "fin",
        };

        const sortColumn = allowedSort[sort] || "inicio";
        const sortOrder = order === "asc" ? "ASC" : "DESC";

        let searchSql = "";
        const paramsSearch = [];
        if (search) {
            const searchValue = `%${search}%`;
            searchSql = ` WHERE titulo LIKE ?`;
            paramsSearch.push(searchValue);
        }

        const [notFilteredRows] = await conn(`SELECT COUNT(*) as total FROM turnos`);
        const [filteredRows] = await conn(`SELECT COUNT(*) as total FROM turnos ${searchSql}`, paramsSearch);
        const dataRows = await conn(
            `SELECT * FROM turnos ${searchSql} ORDER BY ${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`,
            [...paramsSearch, limit, offset]
        );

        res.json({
            total: filteredRows.total,
            totalNotFiltered: notFilteredRows.total,
            rows: dataRows || []
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ total: 0, totalNotFiltered: 0, rows: [], error: 'error al listar turnos' });
    }
});

router.post('/data', checkAuthenticated, async (req, res) => {
    const conn = req.app.get('db_single');
    const { error, value } = turnoSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, msg: error.details[0].message });

    try {
        const result = await conn(
            `INSERT INTO turnos (titulo, inicio, fin) VALUES (?, ?, ?)`,
            [value.titulo, value.inicio, value.fin]
        );
        res.json({ ok: true, msg: 'turno creado', id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, msg: 'error al crear turno' });
    }
});

router.put('/data/:id', checkAuthenticated, async (req, res) => {
    const conn = req.app.get('db_single');
    const { id } = req.params;
    const { error, value } = turnoSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, msg: error.details[0].message });

    try {
        const actual = await conn(`SELECT * FROM turnos WHERE id = ?`, [id]);
        if (!actual.length) return res.status(404).json({ ok: false, msg: 'turno no encontrado' });

        const cambios = {};
        for (const campo of ['titulo', 'inicio', 'fin']) {
            if (value[campo] !== actual[0][campo]) cambios[campo] = value[campo];
        }

        if (!Object.keys(cambios).length) {
            return res.json({ ok: true, msg: 'sin cambios' });
        }

        const setClause = Object.keys(cambios).map(c => `${c} = ?`).join(', ');
        await conn(
            `UPDATE turnos SET ${setClause} WHERE id = ?`,
            [...Object.values(cambios), id]
        );

        res.json({ ok: true, msg: 'turno actualizado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, msg: 'error al actualizar turno' });
    }
});

router.delete('/data/:id', checkAuthenticated, async (req, res) => {
    const conn = req.app.get('db_single');

    try {
        await conn(`DELETE FROM turnos WHERE id = ?`, [req.params.id]);
        res.json({ ok: true, msg: 'turno eliminado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, msg: 'error al eliminar turno' });
    }
});

module.exports = router;