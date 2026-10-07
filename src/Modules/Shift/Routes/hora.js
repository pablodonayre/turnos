const express = require('express');
const router = express.Router();
const trimRequest = require('../../../Library/Helpers/trim-request');
const validateToken = require('../../Core/Middleware/validateToken');
const jwt = require('jsonwebtoken');
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

router.get('/', trimRequest.body, /*validateToken,*/ async (req, res) => {
    const db_single = req.app.get('db_single');
    try {

        console.log('hora')

        let hora = DateTime.now();
        let hora_lima = hora.setZone('America/Lima').toFormat('dd/MM/yyyy HH:mm:ss');

        return res.status(200).json({ status: 'success', timestamp : hora.toUnixInteger(), zona_horaria: "America/Lima", fecha_hora_lima: hora_lima });

    } catch (e) {
        console.error('ERROR EN MARCAR', e);
        return res.status(500).json({ "flash": "danger", "msg": "Error interno del servidor." });
    }
});


module.exports = router;