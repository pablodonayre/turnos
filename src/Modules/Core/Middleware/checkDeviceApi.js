module.exports = function (req, res, next) {

    if(req.session.user.es_movil && req.session.user.es_movil == true) {
        console.log('Middleware-Device: dispositivo movil');
        return next();
    }

    console.log('Middleware-Device: dispositivo web, no autorizado');

    response_message = {
        "flash": "danger",
        "msg": "Sección solo habilitada para dispositivos móviles.",
        "redirect": "/home"
    }
    req.flash('danger', 'Sección solo habilitada para dispositivos móviles.');

    return res.send(response_message);
};