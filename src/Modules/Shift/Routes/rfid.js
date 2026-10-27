const express = require('express');
const router = express.Router();
const checkNotAuthenticated = require('../../Auth/Middleware/checkNotAuthenticated');
const { marcarSchema } = require('../../../Validations/shift');
const trimRequest = require('../../../Library/Helpers/trim-request');
const validateToken = require('../../Core/Middleware/validateToken');
const jwt = require('jsonwebtoken');
const { crearEvents } = require('../../../Library/calendar');
const { DateTime } = require('luxon');
const checkDeviceApi = require('../../Core/Middleware/checkDeviceApi');
const fs = require('fs');
const path = require('path');
const checkAuthenticatedApi = require('../../Core/Middleware/checkAuthenticatedApi');

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

const detalleDelResultado = [
    "HABILITADO",
    "DESHABILITADO",
    "NO_REGISTRADO",
    "SISTEMA_BLOQUEADO",
    "UID_YA_EXISTE",
    "UID_NUEVO",
    "TARJETA_DAÑADA/INVALIDA",
    "NO_COINCIDE_CON_SERVIDOR"
]

const accionArray = ["ENTRADA", "SALIDA", "REGISTRO"];

router.post('/', trimRequest.body, validateToken, async (req, res) => {
    const db_single = req.app.get('db_single');
    try {

        // const {user_id} = req.token_data;
        const { uid, accion, timestamp, test } = req.body;
        console.log(req.body)

        const response = {
            "habilitado": false, // sale de la info del dispositivo, todavía pendiente
            "detalleDelResultado": detalleDelResultado[0], // sale de la info del dispositivo, todavía pendiente
            "usuario": "",
            "modo": "ASISTENCIA", // sale de la info del dispositivo, todavía pendiente
            "duplicado": false, // Clave duplicada: dispositivo+uid+accion+timestamp.
            // status = false; // boolean; solo en errores
            // message = "" // ???
        }

        /* VALIDANDO Content-Type no JSON */
        if (!req.is('json')) {
            return res.status(400).json({"status":"error","message":"Se esperaba Content-Type application/json"});
        }

        /* VALIDANDO UID */
        if(!uid || uid == ""){
            return res.status(400).json({"status":"error","message":"UID ausente o inválido"});
        }
        
        if(uid == "00 00 00 00"){
            response.detalleDelResultado = detalleDelResultado[6];
            return res.json(response);
        }

        /* VALIDANDO LA ACCION */
        if(!accionArray.includes(accion)){
            return res.status(400).json({"status":"error","message":"La acción debe ser ENTRADA, SALIDA o REGISTRO"});
        }

        /* BUSCANDO Y VALIDANDO AL USUARIO */
        // const rows = await db_single(`SELECT * FROM usuarios WHERE id = ? LIMIT 1`, [user_id]);
        const rows = await db_single(`SELECT * FROM usuarios WHERE uid = ? LIMIT 1`, [uid]);
        const user = rows[0];
        console.log(user)
        
        if (!user) {
            response.detalleDelResultado = detalleDelResultado[2];
            return res.json(response);
            //return res.status(404).json({ "flash": "danger", "msg": "Usuario no encontrado."});
        }
        if (user.estatus == 0) {
            response.detalleDelResultado = detalleDelResultado[2];
            return res.json(response);
            //return res.status(403).json({ "flash": "danger", "msg": "Usuario inactivo."});
        }
        response.usuario = user.nombre + " " + user.apellido;
        response.habilitado = true;// user.estatus == 1 ? true : false;

        /* VALIDANDO QUE NO SEA UN REGISTRO DUPLICADO */
        const duplicadoRow = await db_single(`SELECT * FROM log WHERE dispositivo = ? AND uid = ? AND accion = ? AND timestamp = ?`, [req.token_data.device_id, uid, accion, timestamp]);

        if(duplicadoRow.length > 0){
            response.duplicado = true;

            return res.json(response);
        }

        const current_time = DateTime.now().setZone('America/Lima').ts;

        if(accion == "ENTRADA" || accion == "SALIDA"){

            const statusRows = await db_single(`SELECT * FROM user_status WHERE usuario_id = ? LIMIT 1`, [user.id]);
            
            const currentStatus = statusRows[0];
            const nuevoEstado = (!currentStatus || currentStatus.estado == 0) ? 1 : 0;
            const tipoLog = nuevoEstado;
    
            const ahora = DateTime.fromSeconds(timestamp); // DateTime.now(); // debe ser el tiempo en el que se recibió la consulta
            const ahora_min = ahora.hour * 60 + ahora.minute;
    
    
            let alerta = 0;
            let alertaMsg = null;
    
            // const msOfDayAhora =
            //         ahora.hour * 3600000 +
            //         ahora.minute * 60000 +
            //         ahora.second * 1000 +
            //         ahora.millisecond;
            
            console.log("ACCION", nuevoEstado, currentStatus.estado, accion)
            if (nuevoEstado == 0 && currentStatus.estado == 1 && accion == "SALIDA") {
                // SALIDA
                /**
                 * falta buscar el mensaje de inicio de turno para formar el mensaje en el calendario
                 */
                const inicioTurno = new Date(Number(currentStatus.actualizado_fecha));
                const finTurno = new Date(ahora.ts);
                console.log('TURNO CERRADO - usuario:', uid);
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
                    alertaMsg = `Saliste tarde por ${ formatoTiempo(diffMin) }`;
                    // alertaMsg = `Saliste tarde por ${formatearTiempo(diffMin)}`;
                } else if (diffMin < 0) {
                    alerta = 0;
                    alertaMsg = `Saliste temprano por ${ formatoTiempo(Math.abs(diffMin))}`;
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
                if(test == false){
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
                }
        
            } else if(accion == "ENTRADA" && currentStatus.estado == 0) {
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
                    alertaMsg = `Llegaste tarde por ${ formatoTiempo(diffMin) }`;
                } else if (diffMin < 0) {
                    alerta = 0;
                    alertaMsg = `Llegaste temprano por ${ formatoTiempo(Math.abs(diffMin)) }`;
                } else {
                    alerta = 0;
                    alertaMsg = 'Llegaste a tiempo';
                }
    
                console.log('diffMin', diffMin, alertaMsg);
            } else {
                response.habilitado = false;
                response.detalleDelResultado = detalleDelResultado[7];
                response.usuario = detalleDelResultado[7];
                
                return res.json(response);
            }
    
            //return;
    
            if(test == true){
                response.habilitado = false;
                response.detalleDelResultado = detalleDelResultado[2];
                response.usuario = "Desconocido";
                response.modo = "TEST";

                return res.json(response);

            } else {
                // console.log('d', [user.id, tipoLog, ahora.ts, ahora.ts, alerta, alertaMsg, "", "", "", dispositivo, uid, accion, timestamp])
                await db_single(
                    `INSERT INTO log (usuario_id, tipo, fecha_hora, creado_fecha, alerta, alerta_msg, comentario, archivo_server, archivo_usuario, dispositivo, uid, accion, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [user.id, tipoLog, ahora.ts, current_time, alerta, alertaMsg, "", "", "", req.token_data.device_id, uid, accion, timestamp]
                );
        
                if (currentStatus) {
                    await db_single('UPDATE user_status SET estado = ?, actualizado_fecha = ? WHERE usuario_id = ?', [nuevoEstado, ahora.ts, user.id]);
                } else {
                    await db_single('INSERT INTO user_status (usuario_id, estado, actualizado_fecha) VALUES (?, ?, ?)', [user.id, nuevoEstado, ahora.ts]);
                }
            }

        }

        if(accion == "REGISTRO"){
            // registro implica que siempre sera nuevo o valida que ya exista
            response.habilitado = false;
            response.detalleDelResultado = detalleDelResultado[5];
            response.usuario = "NUEVO UID";
            response.modo = "REGISTRO";
            
            return res.json(response);
        }


        return res.json(response);

        // return res.json({
        //     "habilitado": habilitado,
        //     "detalleDelResultado": detalleDelResultado,
        //     "usuario": user[0].nombre + " " + user[0].apellido,
        //     "modo": modo,
        //     "duplicado": duplicado,

        //     "msg": nuevoEstado === 1 ? "Entrada registrada correctamente." : "Salida registrada correctamente.",
        //     "tipo": nuevoEstado === 1 ? "entrada" : "salida",
        //     "estado": nuevoEstado,
        //     "alerta": alerta,
        //     "alerta_msg": alertaMsg,
        //     "fecha": ahora.setLocale('es').toFormat("cccc dd 'de' LLLL yyyy, HH:mm")
        // });

    } catch (e) {
        console.error('ERROR EN MARCAR', e);
        return res.status(500).json({ "flash": "danger", "msg": "Error interno del servidor." });
    }
});

router.post('/device', trimRequest.body, [checkAuthenticatedApi/*, checkDeviceApi*/], async (req, res) => {
    const db_single = req.app.get('db_single');
    try {

        // const { uid, accion, timestamp, test } = req.body;
        const { accion, ubicacion, descripcion, archivo_server, archivo_usuario } = req.body;
        const timestamp = DateTime.now().setZone('America/Lima').toSeconds();

        console.log(req.body)

        const response = {
            "habilitado": true, // sale de la info del dispositivo, todavía pendiente
            "detalleDelResultado": detalleDelResultado[0], // sale de la info del dispositivo, todavía pendiente
            "usuario": "",
            "modo": "ASISTENCIA", // sale de la info del dispositivo, todavía pendiente
            "duplicado": false, // Clave duplicada: dispositivo+uid+accion+timestamp.
            "flash": "danger"
        }

        /* VALIDANDO Content-Type no JSON */
        if (!req.is('json')) {
            return res.status(400).json({"status":"error","message":"Se esperaba Content-Type application/json"});
        }

        /* VALIDANDO LA ACCION */
        if(!accionArray.includes(accion)){
            return res.status(400).json({"status":"error","message":"La acción debe ser ENTRADA, SALIDA o REGISTRO"});
        }

        /* BUSCANDO Y VALIDANDO AL USUARIO */
        const rows = await db_single(`SELECT * FROM usuarios WHERE id = ? LIMIT 1`, [req.session.user.user_id]);
        const user = rows[0];
        console.log('user', user)
        
        if (!user) {
            response.detalleDelResultado = detalleDelResultado[2];
            return res.json(response);
            //return res.status(404).json({ "flash": "danger", "msg": "Usuario no encontrado."});
        }
        if (user.estatus == 0) {
            response.detalleDelResultado = detalleDelResultado[2];
            return res.json(response);
            //return res.status(403).json({ "flash": "danger", "msg": "Usuario inactivo."});
        }
        response.usuario = user.nombre + " " + user.apellido;

        /* BUSCANDO EL ID DEL DISPOSITIVO REMOTO */
        const disp_remoto = await db_single(`SELECT id FROM dispositivos WHERE nombre LIKE "%remoto%"`);
        console.log('remot', disp_remoto)


        /* VALIDANDO QUE NO SEA UN REGISTRO DUPLICADO */
        const duplicadoRow = await db_single(`SELECT * FROM log WHERE dispositivo = ? AND uid = ? AND accion = ? AND timestamp = ?`, [disp_remoto[0]?.id || 0, user.uid, accion, timestamp]);

        if(duplicadoRow.length > 0){
            response.duplicado = true;

            return res.json(response);
        }

        const current_time = DateTime.now().setZone('America/Lima').ts;

        /* MOVIENDO LA IMAGEN SI EXISTE */
        if(archivo_server && archivo_server != ''){
            const tempPath = path.join(__dirname, '..', '..', '..', 'public', 'img', 'temp', archivo_server);
            const permPath = path.join(__dirname, '..', '..', '..', 'public', 'img', 'perm', archivo_server);

            if (fs.existsSync(tempPath)) {
                fs.renameSync(tempPath, permPath);
            } else if (!fs.existsSync(permPath)) {
                return res.status(400).json({ flash: 'danger', msg: 'El archivo no se encontró en el servidor.' });
            }
        }

        if(accion == "ENTRADA" || accion == "SALIDA"){

            const statusRows = await db_single(`SELECT * FROM user_status WHERE usuario_id = ? LIMIT 1`, [user.id]);
            
            const currentStatus = statusRows[0];
            const nuevoEstado = (!currentStatus || currentStatus.estado == 0) ? 1 : 0;
            const tipoLog = nuevoEstado;
    
            const ahora = DateTime.fromSeconds(timestamp); // debe ser el tiempo en el que se recibió la consulta
            const ahora_min = ahora.hour * 60 + ahora.minute;
    
            let alerta = 0;
            let alertaMsg = null;
            response.nuevo_estado = nuevoEstado;        
            
            console.log("ACCION", nuevoEstado, currentStatus.estado, accion)
            if (nuevoEstado == 0 && currentStatus.estado == 1 && accion == "SALIDA") {
                // SALIDA
                /**
                 * falta buscar el mensaje de inicio de turno para formar el mensaje en el calendario
                 */
                const inicioTurno = new Date(Number(currentStatus.actualizado_fecha));
                const finTurno = new Date(ahora.ts);
                console.log('TURNO CERRADO - usuario:', user.uid);
                console.log('Inicio:', inicioTurno.toISOString());
                console.log('Fin:', finTurno.toISOString());
    
                const entradaRows = await db_single(
                    `SELECT * FROM log WHERE usuario_id = ? AND tipo = 1 ORDER BY fecha_hora DESC LIMIT 1`,
                    [user.id]
                );
                const entradaLog = entradaRows[0];
    
                const target_luxon = DateTime.fromMillis(user.salida);
                const target_min = target_luxon.hour * 60 + target_luxon.minute;
    
                let diffMin = ahora_min - target_min;
                if(diffMin > 720){
                    diffMin -= 1440; // por si cruza la media noche
                }
    
                if(diffMin < -720){
                    diffMin += 1440;
                }
    
                if (diffMin > 0) {
                    alerta = 1;
                    alertaMsg = `Saliste tarde por ${ formatoTiempo(diffMin) }`;
                } else if (diffMin < 0) {
                    alerta = 0;
                    alertaMsg = `Saliste temprano por ${ formatoTiempo(Math.abs(diffMin))}`;
                } else {
                    alerta = 0;
                    alertaMsg = 'Saliste a tiempo';
                }
    
                console.log('diffMin', diffMin, alertaMsg);
    
                alerta = 0;
                const description = `Turno registrado automáticamente por shiftControl. 
                Entrada: ${entradaLog ? entradaLog.alerta_msg : 'Sin registro'}
                Salida: ${alertaMsg}`;

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
        
            } else if(accion == "ENTRADA" && currentStatus.estado == 0) {
                // INGRESO
                
                const target_luxon = DateTime.fromMillis(user.ingreso);
                const target_min = target_luxon.hour * 60 + target_luxon.minute;
    
                let diffMin = ahora_min - target_min;
                if(diffMin > 720){
                    diffMin -= 1440; // por si cruza la media noche
                }
    
                if(diffMin < -720){
                    diffMin += 1440;
                }
    
                if (diffMin > 0) {
                    alerta = 1;
                    alertaMsg = `Llegaste tarde por ${ formatoTiempo(diffMin) }`;
                } else if (diffMin < 0) {
                    alerta = 0;
                    alertaMsg = `Llegaste temprano por ${ formatoTiempo(Math.abs(diffMin)) }`;
                } else {
                    alerta = 0;
                    alertaMsg = 'Llegaste a tiempo';
                }
    
                console.log('diffMin', diffMin, alertaMsg);
            } else {
                response.habilitado = false;
                response.detalleDelResultado = detalleDelResultado[7];
                response.usuario = detalleDelResultado[7];
                
                return res.json(response);
            }
            
            response.flash = "success";
            await db_single(
                `INSERT INTO log (usuario_id, tipo, fecha_hora, creado_fecha, alerta, alerta_msg, comentario, archivo_server, archivo_usuario, dispositivo, uid, accion, timestamp, ubicacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [user.id, tipoLog, ahora.ts, current_time, alerta, alertaMsg, descripcion, archivo_server, archivo_usuario, disp_remoto[0]?.id || 0, user.uid, accion, timestamp, ubicacion]
            );
    
            if (currentStatus) {
                await db_single('UPDATE user_status SET estado = ?, actualizado_fecha = ? WHERE usuario_id = ?', [nuevoEstado, ahora.ts, user.id]);
            } else {
                await db_single('INSERT INTO user_status (usuario_id, estado, actualizado_fecha) VALUES (?, ?, ?)', [user.id, nuevoEstado, ahora.ts]);
            }

        }

        return res.json(response);

    } catch (e) {
        console.error('ERROR EN MARCAR', e);
        return res.status(500).json({ "flash": "danger", "msg": "Error interno del servidor." });
    }
});


function formatoTiempo(minutos){
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;

    return `${String(horas).padStart(2, '0')} H: ${String(mins).padStart(2, '0')} M`;
}

module.exports = router;