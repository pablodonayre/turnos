module.exports = (req, res, next) => {

    console.log('mid device', req.session.user.es_movil)
    if (!req.session.user.es_movil && req.session.user.es_movil == false) {
        req.flash('danger', 'Sección solo habilitada para dispositivos móviles.');
        return res.redirect('/home');
    }
    next();
}
