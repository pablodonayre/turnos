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

router.post('/', trimRequest.body, validateToken, async (req, res) => {
    const db_single = req.app.get('db_single');
    try {

        console.log('estado')

        const { modo_actual } = req.body;

        const device = await db_single(`SELECT * 
            FROM dispositivos WHERE id = ${ req.token_data.device_id }`
        );

        console.log('modo db', device[0].modo)
        console.log('modo recibido', modo_actual)

        // si la DB no coincide con el equipo sigue enviando como orden pendiente
        let orden_pendiente = null;

        if(device && device.length > 0){
            if(device[0].modo != modo_actual){
                orden_pendiente = true;
            } else {
                await db_single(`UPDATE dispositivos SET cambiar_modo = 0 WHERE id = ${ req.token_data.device_id }`);
            }
        }

        const response = {
            "ok": true, // confirmación de recepción
            "modo_recibido": modo_actual,
            "orden_pendiente": orden_pendiente,
        }


        return res.json(response)

      

    } catch (e) {
        console.error('ERROR EN MARCAR', e);
        return res.status(500).json({ "flash": "danger", "msg": "Error interno del servidor." });
    }
});


module.exports = router;