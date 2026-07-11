module.exports = function (req, res, next) {

    if(req.session.user != undefined) {
        if(req.session.user.rol === 'ADMIN') {
            console.log('Middleware-Admin-Api: Autenticado');
            return next();
        }
    }

    console.log('Middleware-Admin-Api: [403] No autenticado');

    response_message = {
        "flash": "danger",
        "msg": "[403] No tienes permiso para acceder a esta sección",
        "redirect": "/auth"
    }
    req.flash('danger', 'No tienes permiso para acceder a esta sección.');

    return res.send(response_message);
};