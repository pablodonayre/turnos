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
]

const accionArray = ["ENTRADA", "SALIDA", "REGISTRO"];

router.post('/', trimRequest.body, /*validateToken,*/ async (req, res) => {
    const db_single = req.app.get('db_single');
    try {

        // const {user_id} = req.token_data;
        const { uid, accion, timestamp, dispositivo, test } = req.body;
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

        /* VALIDANDO QUE NO SEA UN REGISTRO DUPLICADO */
        const duplicadoRow = await db_single(`SELECT * FROM log WHERE dispositivo = ? AND uid = ? AND accion = ? AND timestamp = ?`, [dispositivo, uid, accion, timestamp]);

        if(duplicadoRow.length > 0){
            response.duplicado = true;

            return res.json(response);
        }

        if(accion == "ENTRADA" || accion == "SALIDA"){

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
    
            if(test == true){
                response.habilitado = false;
                response.detalleDelResultado = detalleDelResultado[2];
                response.usuario = "Desconocido";
                response.modo = "TEST";
            } else {
                console.log('d', [user.id, tipoLog, ahora.ts, ahora.ts, alerta, alertaMsg, "", "", "", dispositivo, uid, accion, timestamp])
                await db_single(
                    `INSERT INTO log (usuario_id, tipo, fecha_hora, creado_fecha, alerta, alerta_msg, comentario, archivo_server, archivo_usuario, dispositivo, uid, accion, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [user.id, tipoLog, ahora.ts, ahora.ts, alerta, alertaMsg, "", "", "", dispositivo, uid, accion, timestamp]
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
        }


        return res.json(response)

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


module.exports = router;