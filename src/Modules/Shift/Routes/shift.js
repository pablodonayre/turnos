const express = require('express');
const router = express.Router();
const checkNotAuthenticated = require('../../Auth/Middleware/checkNotAuthenticated');
const { marcarSchema } = require('../../../Validations/shift');
const trimRequest = require('../../../Library/Helpers/trim-request');
const validateToken = require('../../Core/Middleware/validateToken');
const jwt = require('jsonwebtoken');
const { crearEvents } = require('../../../Library/calendar');
const checkAuthenticated = require('../../Core/Middleware/checkAuthenticated');
const { DateTime } = require('luxon');

router.get('/test', async(req, res) => {
    try {
        const payload = {
            user_id: 1
        }

        const token = jwt.sign(payload, process.env.JWT_PRIVATE_KEY, {
            expiresIn: process.env.JWT_LIFE
        })

        return res.json({
            token: token
        })
    } catch (error) {
        console.log(error)
    }
})


router.post('/marcar', trimRequest.body, validateToken, async (req, res) => {
    const db_single = req.app.get('db_single');
    try {

        const {user_id} = req.token_data;

        const rows = await db_single(`SELECT * FROM usuarios WHERE id = ? LIMIT 1`, [user_id]);
        const user = rows[0];

        if (!user) {
            return res.status(404).json({ "flash": "danger", "msg": "Usuario no encontrado."});
        }
        if (user.estatus == 0) {
            return res.status(403).json({ "flash": "danger", "msg": "Usuario inactivo."});
        }

        const statusRows = await db_single(`SELECT * FROM user_status WHERE usuario_id = ? LIMIT 1`, [user.id]);
        const currentStatus = statusRows[0];
        const nuevoEstado = (!currentStatus || currentStatus.estado == 0) ? 1 : 0;
        const tipoLog = nuevoEstado;

        const ahora = DateTime.now();
        const ahora_min = ahora.hour * 60 + ahora.minute;


        let alerta = 0;
        let alertaMsg = null;

        // const msOfDayAhora =
        //         ahora.hour * 3600000 +
        //         ahora.minute * 60000 +
        //         ahora.second * 1000 +
        //         ahora.millisecond;

        if (nuevoEstado == 0 && currentStatus) {
            // SALIDA

            /**
             * falta buscar el mensaje de inicio de turno para formar el mensaje en el calendario
             */
            const inicioTurno = new Date(Number(currentStatus.actualizado_fecha));
            const finTurno = new Date(ahora.ts);
            console.log('TURNO CERRADO - usuario:', user_id);
            console.log('Inicio:', inicioTurno.toISOString());
            console.log('Fin:', finTurno.toISOString());

            const entradaRows = await db_single(
                `SELECT * FROM log WHERE usuario_id = ? AND tipo = 1 ORDER BY fecha_hora DESC LIMIT 1`,
                [user.id]
            );
            const entradaLog = entradaRows[0];

            // buscar el día actual y setearle las horas y min de la data del usuario
            // const target_luxon = DateTime.fromMillis(user.salida);
            // const target = ahora.set({ hour: target_luxon.hour, minute: target_luxon.minute, second: 0, millisecond: 0});

            // console.log('ahora', ahora.ts)
            // console.log('target', target.ts)

            // // const diffMin = ahora.diff(target, ["hours", "minutes", "seconds"]);
            // // console.log("diff", diffMin)
            // const diffMin = Math.round((ahora.ts - target.ts) / (60 * 1000));
            // console.log(ahora.ts - target.ts)

            const target_luxon = DateTime.fromMillis(user.salida);
            const target_min = target_luxon.hour * 60 + target_luxon.minute;


            let diffMin = ahora_min - target_min;
            if(diffMin > 720){
                diffMin -= 1440; // por si cruza la media noche
            }

            if(diffMin < -720){
                diffMin += 1440;
            }

            /*
            const target = DateTime.fromMillis(Number(user.salida));
            const msOfDayTarget =
                target.hour * 3600000 +
                target.minute * 60000 +
                target.second * 1000 +
                target.millisecond;

            const diffMin = Math.round((msOfDayAhora - msOfDayTarget) / 60000);
            */

            if (diffMin > 0) {
                alerta = 1;
                alertaMsg = `Saliste tarde por ${diffMin} min`;
                // alertaMsg = `Saliste tarde por ${formatearTiempo(diffMin)}`;
            } else if (diffMin < 0) {
                alerta = 0;
                alertaMsg = `Saliste temprano por ${Math.abs(diffMin)} min`;
                // alertaMsg = `Saliste temprano por ${formatearTiempo(Math.abs(diffMin))}`;
            } else {
                alerta = 0;
                alertaMsg = 'Saliste a tiempo';
            }

            console.log('diffMin', diffMin, alertaMsg);

            alerta = 0;
            //alertaMsg = 'Salida registrada';
            const description = `Turno registrado automáticamente por shiftControl. 
            Entrada: ${entradaLog ? entradaLog.alerta_msg : 'Sin registro'}
            Salida: ${alertaMsg}
            `;
            //const description = `Turno registrado automáticamente por shiftControl`;

            try {
                await crearEvents(
                    user.id_calendario,
                    `Turno - ${user.nombre} ${user.apellido}`,
                    description,
                    inicioTurno.getTime(),
                    finTurno.getTime()
                );
            } catch (calErr) {
                console.error('ERROR AL CREAR EVENTO EN CALENDARIO', calErr);
            }

        } else {
            // INGRESO
            
            //     const target = DateTime.fromMillis(Number(user.ingreso));
            //     const msOfDayTarget =
            //         target.hour * 3600000 +
            //         target.minute * 60000 +
            //         target.second * 1000 +
            //         target.millisecond;

            // console.log('ingreso', user.ingreso)
            // console.log('msOfDayAhora', msOfDayAhora)
            // console.log('msOfDayTarget', msOfDayTarget)
            
            // const diffMin = Math.round((msOfDayAhora - msOfDayTarget) / 60000);

            
            // const target_luxon = DateTime.fromMillis(user.ingreso);
            // const target = ahora.set({ hour: target_luxon.hour, minute: target_luxon.minute, second: 0, millisecond: 0});
            const target_luxon = DateTime.fromMillis(user.ingreso);
            const target_min = target_luxon.hour * 60 + target_luxon.minute;

            let diffMin = ahora_min - target_min;
            if(diffMin > 720){
                diffMin -= 1440; // por si cruza la media noche
            }

            if(diffMin < -720){
                diffMin += 1440;
            }

        
            // const diffMin = Math.round((ahora.ts - target.ts) / (1000));

            if (diffMin > 0) {
                alerta = 1;
                alertaMsg = `Llegaste tarde por ${diffMin} min`;
            } else if (diffMin < 0) {
                alerta = 0;
                alertaMsg = `Llegaste temprano por ${Math.abs(diffMin)} min`;
            } else {
                alerta = 0;
                alertaMsg = 'Llegaste a tiempo';
            }

            console.log('diffMin', diffMin, alertaMsg);
        }

        //return;


        await db_single(
            `INSERT INTO log (usuario_id, tipo, fecha_hora, creado_fecha, alerta, alerta_msg, comentario, archivo_server, archivo_usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [user.id, tipoLog, ahora.ts, ahora.ts, alerta, alertaMsg, "", "", ""]
        );

        if (currentStatus) {
            await db_single('UPDATE user_status SET estado = ?, actualizado_fecha = ? WHERE usuario_id = ?', [nuevoEstado, ahora.ts, user.id]);
        } else {
            await db_single('INSERT INTO user_status (usuario_id, estado, actualizado_fecha) VALUES (?, ?, ?)', [user.id, nuevoEstado, ahora.ts]);
        }

        return res.json({
            "flash": "success",
            "msg": nuevoEstado === 1 ? "Entrada registrada correctamente." : "Salida registrada correctamente.",
            "tipo": nuevoEstado === 1 ? "entrada" : "salida",
            "estado": nuevoEstado,
            "alerta": alerta,
            "alerta_msg": alertaMsg,
            "fecha": ahora.setLocale('es').toFormat("cccc dd 'de' LLLL yyyy, HH:mm")
        });

    } catch (e) {
        console.error('ERROR EN MARCAR', e);
        return res.status(500).json({ "flash": "danger", "msg": "Error interno del servidor." });
    }
});


function formatearTiempo(sec){
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;

    const h_display = String(h).padStart(2, '0');
    const m_display = String(m).padStart(2, '0');
    const s_display = String(s).padStart(2, '0');

    return `${ h_display }:${ m_display }: ${ s_display }`;

}

module.exports = router;